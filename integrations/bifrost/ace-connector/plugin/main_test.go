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
		"session-id": "harness-session",
	}}
	got, ok := sessionCorrelationFromRequest(req)
	if !ok || got != "explicit-session" {
		t.Fatalf("explicit session must win: got %q ok=%v", got, ok)
	}

	req = &schemas.HTTPRequest{Headers: map[string]string{
		"x-bf-session-id": strings.Repeat("x", schemas.MaxSessionIDLength+1),
		"session-id": "must-not-be-used",
	}}
	if got, ok := sessionCorrelationFromRequest(req); ok || got != "" {
		t.Fatalf("invalid explicit session must fail closed rather than fall back: got %q ok=%v", got, ok)
	}

	req = &schemas.HTTPRequest{Headers: map[string]string{
		"x-claude-code-session-id": strings.Repeat("x", schemas.MaxSessionIDLength+1),
		"session-id": "codex-session",
	}}
	got, ok = sessionCorrelationFromRequest(req)
	if !ok || got != "codex-session" {
		t.Fatalf("invalid harness candidate should allow the next supported harness header: got %q ok=%v", got, ok)
	}
}

func TestRequestBoundIdentityDoesNotDependOnLaterBifrostContextPopulation(t *testing.T) {
	body := []byte(`{"model":"openai/test-model","messages":[{"role":"user","content":"find handler"}]}`)
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

func TestResponsesOnlyQuarantineBlocksEveryGenerationRoute(t *testing.T) {
	cases := []struct {
		path string
		status int
	}{
		{"/v1/chat/completions", 410},
		{"/chat/completions", 410},
		{"/openai/chat/completions", 410},
		{"/v1/responses", 503},
		{"/responses", 503},
		{"/openai/responses", 503},
		{"/chatgpt_passthrough/backend-api/codex/responses", 415},
		{"/v1/completions", 415},
		{"/v1/messages", 415},
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
