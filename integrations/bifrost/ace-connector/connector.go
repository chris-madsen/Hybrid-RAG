package connector

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net"
	"net/http"
	"net/url"
	"reflect"
	"strconv"
	"strings"
	"time"
)

const SchemaVersion = "ace.gateway.v1"
const DefaultMaxBodyBytes int64 = 4 * 1024 * 1024
const maxEnvelopeOverhead int64 = 64 * 1024

func maxEnvelopeBytes(bodyBytes int64) int64 {
	return 4*((bodyBytes+2)/3) + maxEnvelopeOverhead
}


func requireJSONFields(value map[string]json.RawMessage, label string, fields ...string) error {
	for _, field := range fields {
		if _, ok := value[field]; !ok {
			return fmt.Errorf("%s is missing required field %q", label, field)
		}
	}
	return nil
}

func normalizeHostCompactionEpoch(raw json.RawMessage) (string, error) {
	var value any
	if err := json.Unmarshal(raw, &value); err != nil {
		return "", errors.New("hostCompactionEpoch must be a non-negative safe integer or unknown")
	}
	switch epoch := value.(type) {
	case string:
		if epoch == "unknown" {
			return epoch, nil
		}
	case float64:
		if epoch >= 0 && epoch <= 9007199254740991 && math.Trunc(epoch) == epoch {
			return strconv.FormatFloat(epoch, 'f', -1, 64), nil
		}
	}
	return "", errors.New("hostCompactionEpoch must be a non-negative safe integer or unknown")
}

func requiredAttestationBinding(attestation map[string]json.RawMessage) (string, string, error) {
	epoch, err := normalizeHostCompactionEpoch(attestation["hostCompactionEpoch"])
	if err != nil {
		return "", "", fmt.Errorf("invalid host attestation epoch: %w", err)
	}
	var activeEngineID string
	if err := json.Unmarshal(attestation["activeEngineId"], &activeEngineID); err != nil || activeEngineID == "" {
		return "", "", errors.New("host attestation activeEngineId must be a non-empty string")
	}
	return epoch, activeEngineID, nil
}

func validateReceiptWire(receipt map[string]json.RawMessage) error {
	if err := requireJSONFields(
		receipt,
		"ACE projection receipt",
		"schemaVersion",
		"requestId",
		"attemptGroupId",
		"attemptIndex",
		"receiptId",
		"decision",
		"baseBodySha256",
		"hostCompactionEpoch",
		"activeEngineId",
		"permittedWireRewrites",
	); err != nil {
		return err
	}

	epochRaw := receipt["hostCompactionEpoch"]
	var epoch int64
	if err := json.Unmarshal(epochRaw, &epoch); err == nil {
		if epoch < 0 {
			return errors.New("ACE projection receipt hostCompactionEpoch must be non-negative or unknown")
		}
	} else {
		var unknown string
		if stringErr := json.Unmarshal(epochRaw, &unknown); stringErr != nil || unknown != "unknown" {
			return errors.New("ACE projection receipt hostCompactionEpoch must be a non-negative integer or unknown")
		}
	}

	rewritesRaw := receipt["permittedWireRewrites"]
	if bytes.Equal(bytes.TrimSpace(rewritesRaw), []byte("null")) {
		return errors.New("ACE projection receipt permittedWireRewrites must be an array")
	}
	var rewrites []string
	if err := json.Unmarshal(rewritesRaw, &rewrites); err != nil {
		return errors.New("ACE projection receipt permittedWireRewrites must be an array of strings")
	}
	seen := make(map[string]struct{}, len(rewrites))
	for _, rewrite := range rewrites {
		if _, ok := seen[rewrite]; ok {
			return errors.New("ACE projection receipt permittedWireRewrites must be unique")
		}
		seen[rewrite] = struct{}{}
	}
	return nil
}

func decodeDecisionEnvelope(reader io.Reader, maxBytes int64) (Decision, error) {
	data, err := io.ReadAll(io.LimitReader(reader, maxBytes+1))
	if err != nil {
		return Decision{}, fmt.Errorf("read ACE projection response: %w", err)
	}
	if int64(len(data)) > maxBytes {
		return Decision{}, errors.New("ACE projection response envelope exceeds the bound")
	}

	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	var decision Decision
	if err := decoder.Decode(&decision); err != nil {
		return Decision{}, fmt.Errorf("decode ACE projection response: %w", err)
	}
	var trailing any
	if err := decoder.Decode(&trailing); err != io.EOF {
		return Decision{}, errors.New("ACE projection response contains trailing data")
	}

	var envelope map[string]json.RawMessage
	if err := json.Unmarshal(data, &envelope); err != nil || envelope == nil {
		return Decision{}, errors.New("ACE projection response must be a JSON object")
	}
	if err := requireJSONFields(envelope, "ACE projection decision", "kind", "receipt"); err != nil {
		return Decision{}, err
	}
	var receipt map[string]json.RawMessage
	if err := json.Unmarshal(envelope["receipt"], &receipt); err != nil || receipt == nil {
		return Decision{}, errors.New("ACE projection receipt must be a JSON object")
	}
	if err := validateReceiptWire(receipt); err != nil {
		return Decision{}, err
	}
	return decision, nil
}

type Request struct {
	RequestID       string
	AttemptGroupID  string
	AgentSessionID  string
	WorkspaceID     string
	DataClass       string
	Protocol        string
	Provider        string
	Model           string
	Query           string
	ProjectionMode  string
	DeadlineEpochMs int64
	Body            []byte
	Attestation     json.RawMessage
}

type Receipt struct {
	SchemaVersion         string   `json:"schemaVersion"`
	RequestID             string   `json:"requestId"`
	AttemptGroupID        string   `json:"attemptGroupId"`
	AttemptIndex          int      `json:"attemptIndex"`
	ProjectionID          string   `json:"projectionId,omitempty"`
	ReceiptID             string   `json:"receiptId"`
	Decision              string   `json:"decision"`
	ReasonCode            string   `json:"reasonCode,omitempty"`
	BaseBodySHA256        string   `json:"baseBodySha256"`
	ProjectedBodySHA256   string   `json:"projectedBodySha256,omitempty"`
	HostCompactionEpoch   any      `json:"hostCompactionEpoch"`
	ActiveEngineID        string   `json:"activeEngineId"`
	PermittedWireRewrites []string `json:"permittedWireRewrites"`
}

type Decision struct {
	Kind       string  `json:"kind"`
	BodyBase64 string  `json:"bodyBase64,omitempty"`
	Receipt    Receipt `json:"receipt"`
}

type Client struct {
	Endpoint     string
	HTTPClient   *http.Client
	MaxBodyBytes int64
}

func validateLoopbackEndpoint(endpoint string) error {
	parsed, err := url.Parse(endpoint)
	if err != nil || parsed.Opaque != "" || parsed.Host == "" || parsed.User != nil {
		return errors.New("ACE projection endpoint must be a loopback HTTP(S) URL")
	}
	if scheme := strings.ToLower(parsed.Scheme); scheme != "http" && scheme != "https" {
		return errors.New("ACE projection endpoint must be a loopback HTTP(S) URL")
	}
	host := strings.ToLower(parsed.Hostname())
	if host == "localhost" {
		return nil
	}
	address := net.ParseIP(host)
	if address == nil || !address.IsLoopback() {
		return errors.New("ACE projection endpoint must be a loopback HTTP(S) URL")
	}
	return nil
}

func (c Client) Project(ctx context.Context, request Request) (Decision, error) {
	if c.Endpoint == "" {
		return Decision{}, errors.New("ACE projection endpoint is required")
	}
	if err := validateLoopbackEndpoint(c.Endpoint); err != nil {
		return Decision{}, err
	}
	maxBodyBytes := c.MaxBodyBytes
	if maxBodyBytes <= 0 {
		maxBodyBytes = DefaultMaxBodyBytes
	}
	if int64(len(request.Body)) > maxBodyBytes {
		return Decision{}, fmt.Errorf("request body exceeds %d-byte bound", maxBodyBytes)
	}
	if request.RequestID == "" || request.AttemptGroupID == "" || request.AgentSessionID == "" || request.WorkspaceID == "" {
		return Decision{}, errors.New("request identity is incomplete")
	}
	var attestation map[string]json.RawMessage
	if err := json.Unmarshal(request.Attestation, &attestation); err != nil || attestation == nil {
		return Decision{}, errors.New("host attestation must be a JSON object")
	}
	requestEpoch, requestActiveEngineID, err := requiredAttestationBinding(attestation)
	if err != nil {
		return Decision{}, err
	}
	if request.DeadlineEpochMs <= time.Now().UnixMilli() {
		return Decision{}, errors.New("ACE projection deadline has expired")
	}
	bodyDigest := sha256.Sum256(request.Body)
	payload := map[string]any{
		"schemaVersion":   SchemaVersion,
		"requestId":       request.RequestID,
		"attemptGroupId":  request.AttemptGroupID,
		"agentSessionId":  request.AgentSessionID,
		"workspaceId":     request.WorkspaceID,
		"dataClass":       request.DataClass,
		"protocol":        request.Protocol,
		"provider":        request.Provider,
		"model":           request.Model,
		"bodyBase64":      base64.StdEncoding.EncodeToString(request.Body),
		"bodySha256":      hex.EncodeToString(bodyDigest[:]),
		"query":           request.Query,
		"projectionMode":  request.ProjectionMode,
		"deadlineEpochMs": request.DeadlineEpochMs,
		"attestation":     json.RawMessage(request.Attestation),
	}
	encoded, err := json.Marshal(payload)
	if err != nil {
		return Decision{}, fmt.Errorf("encode projection request: %w", err)
	}
	if int64(len(encoded)) > maxEnvelopeBytes(maxBodyBytes) {
		return Decision{}, errors.New("ACE projection request envelope exceeds bound")
	}
	deadline := time.Now().Add(30 * time.Second)
	if requested := time.UnixMilli(request.DeadlineEpochMs); requested.Before(deadline) {
		deadline = requested
	}
	boundedCtx, cancel := context.WithDeadline(ctx, deadline)
	defer cancel()
	httpClient := c.HTTPClient
	if httpClient == nil {
		httpClient = http.DefaultClient
	}
	// Projection is a fixed internal API call, not a redirect navigation flow.
	// Never replay the payload to another endpoint, even on the same host.
	safeClient := *httpClient
	safeClient.CheckRedirect = func(_ *http.Request, _ []*http.Request) error {
		return errors.New("ACE projection redirects are not supported")
	}
	httpRequest, err := http.NewRequestWithContext(boundedCtx, http.MethodPost, c.Endpoint, bytes.NewReader(encoded))
	if err != nil {
		return Decision{}, fmt.Errorf("create projection request: %w", err)
	}
	httpRequest.Header.Set("Content-Type", "application/json")
	response, err := safeClient.Do(httpRequest)
	if err != nil {
		return Decision{}, fmt.Errorf("ACE projection request failed: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return Decision{}, fmt.Errorf("ACE projection returned HTTP %d", response.StatusCode)
	}
	decision, err := decodeDecisionEnvelope(response.Body, maxEnvelopeBytes(maxBodyBytes))
	if err != nil {
		return Decision{}, err
	}
	receiptEpochRaw, err := json.Marshal(decision.Receipt.HostCompactionEpoch)
	if err != nil {
		return Decision{}, errors.New("ACE projection receipt hostCompactionEpoch is invalid")
	}
	receiptEpoch, err := normalizeHostCompactionEpoch(receiptEpochRaw)
	if err != nil {
		return Decision{}, err
	}
	if decision.Receipt.SchemaVersion != SchemaVersion ||
		decision.Receipt.RequestID != request.RequestID ||
		decision.Receipt.AttemptGroupID != request.AttemptGroupID ||
		decision.Receipt.AttemptIndex != 0 ||
		decision.Receipt.ReceiptID == "" ||
		decision.Receipt.ActiveEngineID != requestActiveEngineID ||
		receiptEpoch != requestEpoch ||
		decision.Receipt.BaseBodySHA256 != hex.EncodeToString(bodyDigest[:]) ||
		decision.Receipt.Decision != decision.Kind {
		return Decision{}, errors.New("ACE projection receipt does not bind the original attempt, host attestation and decision")
	}
	if int64(len(decision.BodyBase64)) > 4*((maxBodyBytes+2)/3) {
		return Decision{}, errors.New("ACE projected response body exceeds bound")
	}
	if decision.Kind == "APPLY" {
		decoded, err := base64.StdEncoding.DecodeString(decision.BodyBase64)
		if err != nil || int64(len(decoded)) > maxBodyBytes {
			return Decision{}, errors.New("ACE projected body is invalid or exceeds configured bound")
		}
	}
	if decision.Kind == "BLOCK" && decision.BodyBase64 != "" {
		return Decision{}, errors.New("blocked decision must not include a provider body")
	}
	if _, err := Apply(request.Body, decision); err != nil && decision.Kind != "BLOCK" {
		return Decision{}, fmt.Errorf("invalid ACE projection decision: %w", err)
	}
	return decision, nil
}

// Only one request-local rewrite is supported by ace.gateway.v1. A digest
// proves identity of supplied bytes, not that ACE was allowed to mutate the
// model, tools, system instructions, stream mode or the user turn.
func validateChatProjection(original, projected []byte, rewrites []string) error {
	if len(rewrites) != 1 || rewrites[0] != "append_verified_context_system_message" {
		return errors.New("ACE projection requests an unsupported wire rewrite")
	}
	decode := func(body []byte) (map[string]any, error) {
		decoder := json.NewDecoder(bytes.NewReader(body))
		decoder.UseNumber()
		var value map[string]any
		if err := decoder.Decode(&value); err != nil || value == nil {
			return nil, errors.New("ACE provider body must be a JSON object")
		}
		var trailing any
		if err := decoder.Decode(&trailing); err != io.EOF {
			return nil, errors.New("ACE provider body has trailing JSON")
		}
		return value, nil
	}
	base, err := decode(original)
	if err != nil {
		return err
	}
	next, err := decode(projected)
	if err != nil {
		return err
	}
	baseMessages, baseOK := base["messages"].([]any)
	nextMessages, nextOK := next["messages"].([]any)
	if !baseOK || !nextOK || len(nextMessages) != len(baseMessages)+1 {
		return errors.New("ACE must add exactly one context message")
	}
	delete(base, "messages")
	delete(next, "messages")
	if !reflect.DeepEqual(base, next) {
		return errors.New("ACE projection modified protected provider fields")
	}
	insertAt := len(baseMessages)
	for i, item := range baseMessages {
		message, ok := item.(map[string]any)
		if !ok {
			return errors.New("ACE base message is not an object")
		}
		if message["role"] != "system" {
			insertAt = i
			break
		}
	}
	added, ok := nextMessages[insertAt].(map[string]any)
	if !ok || len(added) != 2 || added["role"] != "system" {
		return errors.New("ACE context message has invalid role or fields")
	}
	content, ok := added["content"].(string)
	if !ok || !strings.Contains(content, "[ACE verified context]\n") ||
		!strings.HasSuffix(content, "\n[/ACE verified context]") {
		return errors.New("ACE context message lacks the verified evidence envelope")
	}
	for i, message := range baseMessages {
		j := i
		if i >= insertAt {
			j++
		}
		if !reflect.DeepEqual(message, nextMessages[j]) {
			return errors.New("ACE projection mutated a protected conversation message")
		}
	}
	return nil
}

func Apply(requestBody []byte, decision Decision) ([]byte, error) {
	digest := sha256.Sum256(requestBody)
	if decision.Receipt.BaseBodySHA256 != hex.EncodeToString(digest[:]) {
		return nil, errors.New("projection base digest mismatch")
	}
	if decision.Receipt.Decision != decision.Kind {
		return nil, errors.New("projection receipt decision mismatch")
	}
	switch decision.Kind {
	case "APPLY":
		if decision.BodyBase64 == "" {
			return nil, errors.New("projection decision has no body")
		}
		body, err := base64.StdEncoding.DecodeString(decision.BodyBase64)
		if err != nil {
			return nil, fmt.Errorf("decode projected body: %w", err)
		}
		if len(body) > int(DefaultMaxBodyBytes) || base64.StdEncoding.EncodeToString(body) != decision.BodyBase64 {
			return nil, errors.New("projected body exceeds bound or is not canonical Base64")
		}
		projectedDigest := sha256.Sum256(body)
		if decision.Receipt.ProjectedBodySHA256 != hex.EncodeToString(projectedDigest[:]) {
			return nil, errors.New("projection output digest mismatch")
		}
		if err := validateChatProjection(requestBody, body, decision.Receipt.PermittedWireRewrites); err != nil {
			return nil, err
		}
		return body, nil
	case "BLOCK":
		if decision.BodyBase64 != "" || decision.Receipt.ReasonCode == "" {
			return nil, errors.New("ACE BLOCK decision must have a reason and no provider body")
		}
		return nil, fmt.Errorf("ACE projection blocked: %s", decision.Receipt.ReasonCode)
	default:
		return nil, fmt.Errorf("unsupported ACE projection decision: %s", decision.Kind)
	}
}
