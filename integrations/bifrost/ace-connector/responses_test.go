package connector

import (
    "context"
    "encoding/base64"
    "encoding/json"
    "net/http"
    "net/http/httptest"
    "strings"
    "testing"
    "time"
)

func TestNativeResponsesV2ProjectionPreservesFunctionCallAndReasoning(t *testing.T) {
    original := []byte(`{"model":"openai/gpt-test","store":false,"stream":true,"reasoning":{"effort":"high"},"tools":[{"type":"function","name":"read_file"}],"input":[{"role":"user","content":"find handler"},{"type":"reasoning","id":"r1","encrypted_content":"opaque"},{"type":"function_call","call_id":"call_1","name":"read_file","arguments":"{}"},{"type":"function_call_output","call_id":"call_1","output":"handler found"}]}`)
    projected := []byte(`{"model":"openai/gpt-test","store":false,"stream":true,"reasoning":{"effort":"high"},"tools":[{"type":"function","name":"read_file"}],"input":[{"role":"developer","content":"Untrusted source.\n[ACE verified context]\nsrc/main.ts:12\n[/ACE verified context]"},{"role":"user","content":"find handler"},{"type":"reasoning","id":"r1","encrypted_content":"opaque"},{"type":"function_call","call_id":"call_1","name":"read_file","arguments":"{}"},{"type":"function_call_output","call_id":"call_1","output":"handler found"}]}`)
    server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        if r.URL.Path != "/internal/ace-gateway/v2/project" || r.Header.Get("Authorization") != "Bearer native-test" {
            t.Errorf("request must use authenticated native v2 route")
            w.WriteHeader(401)
            return
        }
        var envelope map[string]json.RawMessage
        if err := json.NewDecoder(r.Body).Decode(&envelope); err != nil { t.Error(err);w.WriteHeader(400);return }
        var protocol, schema, received string
        _ = json.Unmarshal(envelope["protocol"], &protocol)
        _ = json.Unmarshal(envelope["schemaVersion"], &schema)
        _ = json.Unmarshal(envelope["bodyBase64"], &received)
        if protocol != "openai.responses" || schema != "ace.gateway.v2" || received != base64.StdEncoding.EncodeToString(original) {
            t.Error("v2 request must bind untouched native provider input")
            w.WriteHeader(409);return
        }
        decision := ResponsesV2Decision{
            Kind:"PREPARED",ReasonCode:"VERIFIED_CONTEXT_ADDED",
            BaseBodySHA256:digest(original),ProjectedBodySHA256:digest(projected),
            BodyBase64:base64.StdEncoding.EncodeToString(projected),
        }
        _ = json.NewEncoder(w).Encode(decision)
    }))
    defer server.Close()
    client := Client{Endpoint:server.URL+"/internal/ace-gateway/v2/project",AuthToken:"native-test"}
    decision, err := client.ProjectNativeResponses(context.Background(),ResponsesV2Request{
        RequestID:"request-1",AttemptGroupID:"attempt-1",AgentSessionID:"session-1",
        WorkspaceID:"workspace-1",Provider:"openai",Model:"openai/gpt-test",
        DataClass:"private",Query:"handler found",DeadlineEpochMs:time.Now().Add(time.Minute).UnixMilli(),
        Body:original,Attestation:validHostAttestation(t,0),
    })
    if err != nil { t.Fatalf("native projection: %v",err) }
    applied,err:=ApplyNativeResponses(original,decision)
    if err != nil || string(applied)!=string(projected) { t.Fatalf("native replay must remain byte-bound: %v",err) }
}

func TestNativeResponsesRejectsProtectedMutationAndHiddenState(t *testing.T) {
    original:=[]byte(`{"model":"openai/gpt-test","store":false,"input":[{"type":"function_call_output","call_id":"call_1","output":"found"}],"reasoning":{"effort":"high"}}`)
    good:=[]byte(`{"model":"openai/gpt-test","store":false,"input":[{"role":"developer","content":"[ACE verified context]\nsource\n[/ACE verified context]"},{"type":"function_call_output","call_id":"call_1","output":"found"}],"reasoning":{"effort":"high"}}`)
    if err:=validateNativeResponsesProjection(original,good);err!=nil { t.Fatalf("valid developer input: %v",err) }
    cases:=[]string{
      strings.Replace(string(good),`"call_1"`,`"other_call"`,1),
      strings.Replace(string(good),`"high"`,`"low"`,1),
      strings.Replace(string(good),`"store":false`,`"store":true`,1),
      strings.Replace(string(good),`"developer"`,`"system"`,1),
    }
    for i, bad:=range cases {
      if err:=validateNativeResponsesProjection(original,[]byte(bad));err==nil { t.Errorf("protected mutation %d accepted",i) }
    }
}

func TestNativeResponsesV2ProjectionRejectsOutboundURLBeforeHTTP(t *testing.T) {
    c:=Client{Endpoint:"https://example.com/internal/ace-gateway/v2/project",AuthToken:"token",HTTPClient:&http.Client{Transport:unexpectedRoundTripper{}}}
    _,err:=c.ProjectNativeResponses(context.Background(),ResponsesV2Request{})
    if err==nil { t.Fatal("must reject nonloopback before any network") }
}
