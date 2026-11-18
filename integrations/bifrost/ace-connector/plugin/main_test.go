//go:build bifrost_plugin

package main

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/maximhq/bifrost/core/schemas"
)

func TestSessionCorrelationFromRequestMatchesBifrostHeaderPrecedence(t *testing.T) {
	req := &schemas.HTTPRequest{Headers: map[string]string{
		"x-bf-session-id": " explicit-session ",
		"session-id":      "harness-session",
	}}
	got, ok := sessionCorrelationFromRequest(req)
	if !ok || got != "explicit-session" {
		t.Fatalf("explicit session must win: got %q ok=%v", got, ok)
	}

	req = &schemas.HTTPRequest{Headers: map[string]string{
		"x-bf-session-id": strings.Repeat("x", schemas.MaxSessionIDLength+1),
		"session-id":      "must-not-be-used",
	}}
	if got, ok := sessionCorrelationFromRequest(req); ok || got != "" {
		t.Fatalf("invalid explicit session must fail closed rather than fall back: got %q ok=%v", got, ok)
	}

	req = &schemas.HTTPRequest{Headers: map[string]string{
		"x-claude-code-session-id": strings.Repeat("x", schemas.MaxSessionIDLength+1),
		"session-id":               "codex-session",
	}}
	got, ok = sessionCorrelationFromRequest(req)
	if !ok || got != "codex-session" {
		t.Fatalf("invalid harness candidate should allow the next supported harness header: got %q ok=%v", got, ok)
	}
}

func TestRequestBoundIdentityDoesNotDependOnLaterBifrostContextPopulation(t *testing.T) {
	body := []byte(`{"model":"openai/test-model","input":"find handler","store":false}`)
	req := &schemas.HTTPRequest{Headers: map[string]string{"session-id": "codex-session"}, Body: body}
	firstID, sessionID, provider, normalizedModel, rawAttestation, err := requestBoundIdentity(req, body, "openai/test-model")
	if err != nil {
		t.Fatalf("requestBoundIdentity: %v", err)
	}
	secondID, _, _, _, _, err := requestBoundIdentity(req, body, "openai/test-model")
	if err != nil {
		t.Fatalf("second requestBoundIdentity: %v", err)
	}
	if firstID == secondID || !strings.HasPrefix(firstID, "ace-") || len(firstID) != len("ace-")+32 {
		t.Fatalf("physical request IDs must be fresh 128-bit ACE identities: first=%q second=%q", firstID, secondID)
	}
	if sessionID != "codex-session" || provider != "openai" || normalizedModel == "" {
		t.Fatalf("unexpected binding: session=%q provider=%q model=%q", sessionID, provider, normalizedModel)
	}

	var attestation map[string]any
	if err := json.Unmarshal(rawAttestation, &attestation); err != nil {
		t.Fatalf("decode attestation: %v", err)
	}
	if attestation["sessionId"] != sessionID || attestation["hostTranscriptAttested"] != false || attestation["hostCompactionEpoch"] != "unknown" {
		t.Fatalf("unexpected lower-assurance attestation: %#v", attestation)
	}
	if attestation["durableActiveTranscriptRevision"] != "unattested:"+firstID {
		t.Fatalf("attestation must bind the minted physical request ID: %#v", attestation)
	}
}

func TestResponsesOnlyQuarantineBlocksEveryUnsupportedGenerationRoute(t *testing.T) {
	cases := []struct {
		path   string
		status int
	}{
		{"/v1/responses", 503},
		{"/v1/unsupported", 404},
		{"/openai/unsupported", 404},
		{"/unsupported", 404},
	}
	for _, tc := range cases {
		t.Run(tc.path, func(t *testing.T) {
			resp, err := HTTPTransportPreHook(nil, &schemas.HTTPRequest{Method: "POST", Path: tc.path, Body: []byte(`{"model":"openai/test","input":"text"}`)})
			if err != nil || resp == nil || resp.StatusCode != tc.status {
				t.Fatalf("expected fail-closed status %d, got %#v / %v", tc.status, resp, err)
			}
		})
	}
	allow, err := HTTPTransportPreHook(nil, &schemas.HTTPRequest{Method: "GET", Path: "/v1/models"})
	if err != nil || allow != nil {
		t.Fatalf("non-generation model catalog should remain available: %#v / %v", allow, err)
	}
}

func TestPreLLMHookCannotForwardWithoutCertifiedNativeResponses(t *testing.T) {
	_, short, err := PreLLMHook(nil, &schemas.BifrostRequest{})
	if err != nil || short == nil || short.Error == nil || short.Error.AllowFallbacks == nil || *short.Error.AllowFallbacks {
		t.Fatalf("uncertified provider dispatch must be short-circuited without fallback: %#v / %v", short, err)
	}
}

func TestNativeResponsesQueryFromToolResultAndMultimodalUserInput(t *testing.T) {
	fixtures := []struct{ name, body, expected string }{
		{"tool-result", `[{"type":"function_call","call_id":"c1","arguments":"{}"},{"type":"function_call_output","call_id":"c1","output":"tool returned entrypoint"}]`, "tool returned entrypoint"},
		{"multimodal-user", `[{"role":"user","content":[{"type":"input_text","text":"find module"},{"type":"input_image","image_url":"data:image/png;base64,AA=="}]}]`, "find module"},
		{"no-source", `[{"type":"reasoning","encrypted_content":"opaque"}]`, ""},
	}
	for _, tc := range fixtures {
		t.Run(tc.name, func(t *testing.T) {
			got, ok := nativeResponsesQuery(json.RawMessage(tc.body))
			if got != tc.expected || ok != (tc.expected != "") {
				t.Fatalf("native query=%q ok=%v expected=%q", got, ok, tc.expected)
			}
		})
	}
}

func TestNativeResponsesIngressWithoutContextOrWorkspaceNeverSends(t *testing.T) {
	request := &schemas.HTTPRequest{
		Method: "POST", Path: "/v1/responses",
		Body:    []byte(`{"model":"openai/gpt-test","input":"find handler","store":false}`),
		Headers: map[string]string{"session-id": "test-session"},
	}
	previousWorkspace := defaultWorkspaceID
	defaultWorkspaceID = "test-workspace"
	defer func() { defaultWorkspaceID = previousWorkspace }()
	resp, err := HTTPTransportPreHook(nil, request)
	if err != nil || resp == nil || resp.StatusCode != 503 {
		t.Fatalf("missing live transport context must be denied: %+v %v", resp, err)
	}
	_, stop, err := PreLLMHook(nil, &schemas.BifrostRequest{ResponsesRequest: &schemas.BifrostResponsesRequest{Model: "gpt-test"}})
	if err != nil || stop == nil || stop.Error == nil || stop.Error.AllowFallbacks == nil || *stop.Error.AllowFallbacks {
		t.Fatal("no provider dispatch or fallback permitted before physical-send certification")
	}
}
