//go:build bifrost_plugin

package main

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/chris-madsen/Mult-agent-AI-Orchestration/integrations/bifrost/ace-connector"
	"github.com/maximhq/bifrost/core/schemas"
)

const (
	workspaceKey             schemas.BifrostContextKey = "ace.workspace_id"
	physicalRequestIDKey     schemas.BifrostContextKey = "ace.projection.physical_request_id"
	sessionCorrelationKey    schemas.BifrostContextKey = "ace.projection.session_correlation"
	pinnedBifrostCommit                               = "fe7634a6c828927d05ffdd57c62be0aaab04193f"
)

var projectionClient connector.Client
var defaultWorkspaceID string
// Set only by scripts/build-bifrost-ace-plugin.sh from the exact clean ACE checkout.
var aceSourceCommit = "unknown"

func Init(config any) error {
	if len(aceSourceCommit) != 40 || strings.Trim(aceSourceCommit, "0123456789abcdef") != "" {
		return errors.New("ACE plugin source commit provenance is unavailable")
	}
	endpoint := os.Getenv("ACE_GATEWAY_PROJECTION_URL")
	if values, ok := config.(map[string]any); ok {
		if configured, ok := values["projection_url"].(string); ok && configured != "" {
			endpoint = configured
		}
	}
	if endpoint == "" {
		return errors.New("ACE_GATEWAY_PROJECTION_URL is required")
	}
	token := os.Getenv("ACE_GATEWAY_PROJECTION_TOKEN")
	if token == "" {
		return errors.New("ACE_GATEWAY_PROJECTION_TOKEN is required")
	}
	projectionClient = connector.Client{Endpoint: endpoint, AuthToken: token, MaxBodyBytes: connector.DefaultMaxBodyBytes}
	defaultWorkspaceID = os.Getenv("ACE_BIFROST_WORKSPACE_ID")
	return nil
}

func GetName() string { return "ace-gateway-projection" }

func sha256Hex(value []byte) string {
	sum := sha256.Sum256(value)
	return hex.EncodeToString(sum[:])
}

func newPhysicalRequestID() (string, error) {
	var entropy [16]byte
	if _, err := rand.Read(entropy[:]); err != nil {
		return "", fmt.Errorf("mint ACE physical request identity: %w", err)
	}
	return "ace-" + hex.EncodeToString(entropy[:]), nil
}

// sessionCorrelationFromRequest mirrors Bifröst's HTTP session-header precedence,
// but runs in HTTPTransportPreHook, before ConvertToBifrostContext has populated
// BifrostContextKeySessionID. These values are caller-asserted correlation only;
// they are never treated as authenticated identity.
func sessionCorrelationFromRequest(req *schemas.HTTPRequest) (string, bool) {
	if req == nil {
		return "", false
	}
	if raw := req.CaseInsensitiveHeaderLookup("x-bf-session-id"); strings.TrimSpace(raw) != "" {
		return schemas.NormalizeSessionID(raw)
	}
	for _, name := range schemas.HarnessSessionHeaders {
		raw := req.CaseInsensitiveHeaderLookup(name)
		if strings.TrimSpace(raw) == "" {
			continue
		}
		if sessionID, ok := schemas.NormalizeSessionID(raw); ok {
			return sessionID, true
		}
	}
	return "", false
}

func requestBoundIdentity(req *schemas.HTTPRequest, body []byte, rawModel string) (string, string, string, string, json.RawMessage, error) {
	requestID, err := newPhysicalRequestID()
	if err != nil {
		return "", "", "", "", nil, err
	}
	sessionID, okSession := sessionCorrelationFromRequest(req)
	if !okSession {
		return "", "", "", "", nil, errors.New("coding-harness session correlation is unavailable")
	}
	provider, normalizedModel := schemas.ParseModelString(rawModel, "")
	if provider == "" || normalizedModel == "" {
		return "", "", "", "", nil, errors.New("ACE Gateway requires an explicit Bifrost provider/model route")
	}
	providerIdentity := string(provider)
	// Bifröst can attest the exact HTTP request it observes, but it cannot
	// truthfully attest whether the coding agent compacted its own durable
	// transcript before sending those bytes. The ACE request ID is minted here,
	// inside the authenticated post-auth transport hook, because Bifröst's own
	// request/session context is populated only later by ConvertToBifrostContext.
	// The coding-harness session value remains correlation, not authentication.
	attestationValue := map[string]any{
		"hostBuildDigest": sha256Hex([]byte("ace-bifrost-plugin:" + aceSourceCommit + ":" + pinnedBifrostCommit)),
		"sessionId": sessionID,
		"activeEngineId": "bifrost-visible-request-only",
		"effectiveCompressionControlsDigest": sha256Hex([]byte("host-compression-controls:unattested")),
		"durableActiveTranscriptRevision": "unattested:" + requestID,
		"durableActiveTranscriptDigest": sha256Hex(body),
		"hostCompactionEpoch": "unknown",
		"attestorId": "ace-bifrost-plugin@" + aceSourceCommit,
		"providerManagedHistoryCapability": "visible",
		"hostTranscriptAttested": false,
		"compactionEnabled": false,
	}
	attestation, err := json.Marshal(attestationValue)
	if err != nil {
		return "", "", "", "", nil, err
	}
	return requestID, sessionID, providerIdentity, normalizedModel, attestation, nil
}

func stringValue(ctx *schemas.BifrostContext, key schemas.BifrostContextKey) (string, bool) {
	value, ok := ctx.Value(key).(string)
	if !ok || value == "" {
		switch key {
		case workspaceKey:
			value = defaultWorkspaceID
		}
	}
	ok = value != ""
	return value, ok && value != ""
}

func errorResponse(status int, message string) *schemas.HTTPResponse {
	body, _ := json.Marshal(map[string]string{"error": message})
	return &schemas.HTTPResponse{StatusCode: status, Headers: map[string]string{"Content-Type": "application/json"}, Body: body}
}

// Until Responses-native projection and exact per-dispatch authorization exist,
 // NO agent generation route is eligible for ACE forwarding. This deliberate
 // quarantine prevents Chat transport or uncertified Responses from bypassing
 // policy. It is not a working Responses adapter.
func HTTPTransportPreHook(_ *schemas.BifrostContext, req *schemas.HTTPRequest) (*schemas.HTTPResponse, error) {
	if req == nil {
		return errorResponse(400, "ACE gateway request is missing"), nil
	}
	path := req.Path
	switch path {
	case "/v1/models", "/health", "/healthz", "/readyz":
		return nil, nil // administrative endpoints, never provider generation
	case "/v1/chat/completions", "/chat/completions", "/openai/chat/completions":
		return errorResponse(410, "ACE Chat Completions route is retired; only native Responses is eligible"), nil
	case "/v1/responses", "/responses", "/openai/responses":
		return errorResponse(503, "ACE native Responses route is not yet certified"), nil
	default:
		if strings.HasPrefix(path, "/v1/") || strings.HasPrefix(path, "/openai/") ||
			strings.HasPrefix(path, "/chatgpt_passthrough/") ||
			strings.Contains(path, "completions") || strings.Contains(path, "/responses") {
			return errorResponse(415, "ACE gateway model route is unsupported"), nil
		}
		return nil, nil // unrelated Bifrost administration; PreLLM always denies generation
	}
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

// Defense in depth: the HTTP hook is not an authorization receipt.
 // Every normalized model attempt must be blocked until the native Responses
 // per-physical-send guard is implemented and proved on a pinned Bifrost.
func PreLLMHook(_ *schemas.BifrostContext, req *schemas.BifrostRequest) (*schemas.BifrostRequest, *schemas.LLMPluginShortCircuit, error) {
	return blockProviderAttempt(req, "ACE provider dispatch disabled until native Responses is certified")
}

func PostLLMHook(ctx *schemas.BifrostContext, response *schemas.BifrostResponse, bifrostErr *schemas.BifrostError) (*schemas.BifrostResponse, *schemas.BifrostError, error) {
	return response, bifrostErr, nil
}

func Cleanup() error { return nil }
