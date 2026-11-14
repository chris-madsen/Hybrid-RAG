//go:build bifrost_plugin

package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/chris-madsen/Mult-agent-AI-Orchestration/integrations/bifrost/ace-connector"
	"github.com/maximhq/bifrost/core/schemas"
)

const (
	workspaceKey   schemas.BifrostContextKey = "ace.workspace_id"
	sessionKey     schemas.BifrostContextKey = "ace.session_id"
	attemptGroupKey schemas.BifrostContextKey = "ace.attempt_group_id"
	providerKey    schemas.BifrostContextKey = "ace.provider"
	attestationKey schemas.BifrostContextKey = "ace.host_attestation"
	projectedModelKey schemas.BifrostContextKey = "ace.projection.original_model"
	contextDigestKey schemas.BifrostContextKey = "ace.projection.context_sha256"
)

var projectionClient connector.Client
var defaultWorkspaceID string
var defaultSessionID string
var defaultAttemptGroupID string
var defaultProvider string
var defaultAttestation json.RawMessage

func Init(config any) error {
	endpoint := os.Getenv("ACE_GATEWAY_PROJECTION_URL")
	if values, ok := config.(map[string]any); ok {
		if configured, ok := values["projection_url"].(string); ok && configured != "" {
			endpoint = configured
		}
	}
	if endpoint == "" {
		return errors.New("ACE_GATEWAY_PROJECTION_URL is required")
	}
	projectionClient = connector.Client{Endpoint: endpoint, MaxBodyBytes: connector.DefaultMaxBodyBytes}
	defaultWorkspaceID = os.Getenv("ACE_BIFROST_WORKSPACE_ID")
	defaultSessionID = os.Getenv("ACE_BIFROST_SESSION_ID")
	defaultAttemptGroupID = os.Getenv("ACE_BIFROST_ATTEMPT_GROUP_ID")
	defaultProvider = os.Getenv("ACE_BIFROST_PROVIDER")
	if configured := os.Getenv("ACE_BIFROST_HOST_ATTESTATION_JSON"); configured != "" {
		defaultAttestation = json.RawMessage(configured)
	}
	return nil
}

func GetName() string { return "ace-gateway-projection" }

func stringValue(ctx *schemas.BifrostContext, key schemas.BifrostContextKey) (string, bool) {
	value, ok := ctx.Value(key).(string)
	if !ok || value == "" {
		switch key {
		case workspaceKey:
			value = defaultWorkspaceID
		case sessionKey:
			value = defaultSessionID
		case attemptGroupKey:
			value = defaultAttemptGroupID
		case providerKey:
			value = defaultProvider
		}
	}
	ok = value != ""
	return value, ok && value != ""
}

func requestQuery(body []byte) (string, string, error) {
	var decoded struct {
		Model    string `json:"model"`
		Messages []struct {
			Role    string `json:"role"`
			Content any    `json:"content"`
		} `json:"messages"`
	}
	if err := json.Unmarshal(body, &decoded); err != nil {
		return "", "", fmt.Errorf("invalid provider JSON: %w", err)
	}
	if decoded.Model == "" || len(decoded.Messages) == 0 {
		return "", "", errors.New("OpenAI Chat request must contain model and messages")
	}
	for index := len(decoded.Messages) - 1; index >= 0; index-- {
		if decoded.Messages[index].Role != "user" {
			continue
		}
		content, ok := decoded.Messages[index].Content.(string)
		if ok && content != "" {
			return decoded.Model, content, nil
		}
		encoded, err := json.Marshal(decoded.Messages[index].Content)
		if err != nil {
			return "", "", errors.New("user message content is not serializable")
		}
		return decoded.Model, string(encoded), nil
	}
	return "", "", errors.New("OpenAI Chat request has no user query")
}

// Pin the exact projected evidence message across the HTTP-to-LLM parser
// boundary. A receipt alone is not proof that Bifröst retained the context.
func projectedContextDigest(body []byte) (string, error) {
	var value struct {
		Messages []struct {
			Role string `json:"role"`
			Content any `json:"content"`
		} `json:"messages"`
	}
	if err := json.Unmarshal(body, &value); err != nil {
		return "", err
	}
	var digest string
	for _, message := range value.Messages {
		content, ok := message.Content.(string)
		if !ok || !strings.Contains(content, "[ACE verified context]") {
			continue
		}
		if message.Role != "system" || digest != "" {
			return "", errors.New("ACE context message is duplicated or has the wrong role")
		}
		sum := sha256.Sum256([]byte(content))
		digest = hex.EncodeToString(sum[:])
	}
	if digest == "" {
		return "", errors.New("ACE projected body lacks context evidence")
	}
	return digest, nil
}

func errorResponse(status int, message string) *schemas.HTTPResponse {
	body, _ := json.Marshal(map[string]string{"error": message})
	return &schemas.HTTPResponse{StatusCode: status, Headers: map[string]string{"Content-Type": "application/json"}, Body: body}
}

func HTTPTransportPreHook(ctx *schemas.BifrostContext, req *schemas.HTTPRequest) (*schemas.HTTPResponse, error) {
	if req == nil {
		return errorResponse(400, "ACE gateway request is missing"), nil
	}
	if req.Path != "/v1/chat/completions" {
		// Administrative endpoints do not invoke a model. Every unsupported
		// generation route is rejected, not forwarded under a disabled flag.
		if strings.HasPrefix(req.Path, "/v1/") && req.Path != "/v1/models" {
			return errorResponse(415, "ACE gateway model route is unsupported"), nil
		}
		return nil, nil
	}
	if req.Method != "POST" || !strings.HasPrefix(strings.ToLower(req.CaseInsensitiveHeaderLookup("Content-Type")), "application/json") {
		return errorResponse(415, "ACE requires a JSON POST Chat Completions request"), nil
	}
	workspaceID, okWorkspace := stringValue(ctx, workspaceKey)
	sessionID, okSession := stringValue(ctx, sessionKey)
	attemptGroupID, okAttempt := stringValue(ctx, attemptGroupKey)
	provider, okProvider := stringValue(ctx, providerKey)
	attestation, okAttestation := ctx.Value(attestationKey).(json.RawMessage)
	if !okAttestation || len(attestation) == 0 {
		attestation = defaultAttestation
		okAttestation = len(attestation) > 0
	}
	if !okWorkspace || !okSession || !okAttempt || !okProvider || !okAttestation || len(attestation) == 0 {
		return errorResponse(503, "ACE host identity attestation is unavailable"), nil
	}
	model, query, err := requestQuery(req.Body)
	if err != nil {
		return errorResponse(400, err.Error()), nil
	}
	deadline := time.Now().Add(30 * time.Second)
	requestID := fmt.Sprintf("bifrost-%d", time.Now().UnixNano())
	projection, err := projectionClient.Project(ctx, connector.Request{
		RequestID: requestID, AttemptGroupID: attemptGroupID, AgentSessionID: sessionID,
		WorkspaceID: workspaceID, DataClass: "private", Protocol: "openai.chat.completions",
		Provider: provider, Model: model, Query: query, ProjectionMode: "gateway",
		DeadlineEpochMs: deadline.UnixMilli(), Body: req.Body, Attestation: attestation,
	})
	if err != nil {
		return errorResponse(503, "ACE projection unavailable"), nil
	}
	projected, err := connector.Apply(req.Body, projection)
	if err != nil {
		return errorResponse(409, "ACE projection blocked"), nil
	}
	contextDigest, err := projectedContextDigest(projected)
	if err != nil {
		return errorResponse(409, "ACE projected context is invalid"), nil
	}
	req.Body = projected
	ctx.SetValue(contextDigestKey, contextDigest)
	ctx.SetValue(schemas.BifrostContextKey("ace.projection.receipt"), projection.Receipt)
	ctx.SetValue(schemas.BifrostContextKey("ace.projection.base_digest"), projection.Receipt.BaseBodySHA256)
	ctx.SetValue(projectedModelKey, model)
	return nil, nil
}

func PreRequestHook(_ *schemas.BifrostContext, _ *schemas.BifrostRequest) error { return nil }

// Denials must use a short circuit: PreLLMHook errors alone are non-blocking
// in the pinned Bifrost plugin pipeline. Never allow an uncertified fallback.
func blockProviderAttempt(req *schemas.BifrostRequest, reason string) (*schemas.BifrostRequest, *schemas.LLMPluginShortCircuit, error) {
	status := 409
	allowFallbacks := false
	return req, &schemas.LLMPluginShortCircuit{
		Error: &schemas.BifrostError{
			IsBifrostError: true,
			StatusCode: &status,
			Error: &schemas.ErrorField{Message: reason},
			AllowFallbacks: &allowFallbacks,
		},
	}, nil
}

func PreLLMHook(ctx *schemas.BifrostContext, req *schemas.BifrostRequest) (*schemas.BifrostRequest, *schemas.LLMPluginShortCircuit, error) {
	receipt, hasReceipt := ctx.Value(schemas.BifrostContextKey("ace.projection.receipt")).(connector.Receipt)
	if !hasReceipt || receipt.SchemaVersion != connector.SchemaVersion || receipt.Decision != "APPLY" {
		return blockProviderAttempt(req, "ACE projection receipt is missing or not applicable")
	}
	if req == nil || req.ChatRequest == nil {
		return blockProviderAttempt(req, "ACE provider attempt is outside the certified Chat route")
	}
	provider, model, fallbacks := req.GetRequestFields()
	if provider == "" || model == "" || len(fallbacks) != 0 {
		return blockProviderAttempt(req, "ACE provider route or fallback is not certified")
	}
	ingressModel, bound := ctx.Value(projectedModelKey).(string)
	if !bound || ingressModel != model {
		return blockProviderAttempt(req, "ACE provider model differs from authorized ingress payload")
	}
	expectedContextDigest, hasContextDigest := ctx.Value(contextDigestKey).(string)
	foundContext := false
	if hasContextDigest {
		for _, message := range req.ChatRequest.Input {
			if message.Role != schemas.ChatMessageRoleSystem || message.Content == nil || message.Content.ContentStr == nil {
				continue
			}
			sum := sha256.Sum256([]byte(*message.Content.ContentStr))
			if hex.EncodeToString(sum[:]) == expectedContextDigest {
				foundContext = true
				break
			}
		}
	}
	if !foundContext {
		return blockProviderAttempt(req, "ACE context was lost or modified before the provider attempt")
	}
	// Only the initial projected attempt was authorized by HTTPTransportPreHook.
	// Until per-attempt ACE reauthorization is implemented, a second hook call
	// cannot reuse the first attempt's receipt.
	attemptKey := schemas.BifrostContextKey("ace.pre_llm_attempt_seen")
	if ctx.Value(attemptKey) == true {
		return blockProviderAttempt(req, "ACE retry or fallback requires fresh authorization")
	}
	ctx.SetValue(attemptKey, true)
	return req, nil, nil
}

func PostLLMHook(ctx *schemas.BifrostContext, response *schemas.BifrostResponse, bifrostErr *schemas.BifrostError) (*schemas.BifrostResponse, *schemas.BifrostError, error) {
	return response, bifrostErr, nil
}

func Cleanup() error { return nil }
