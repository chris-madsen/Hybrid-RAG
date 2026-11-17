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
    "net/http"
    "net/url"
    "reflect"
    "strings"
    "time"
)

// ResponsesV2Request represents observed, unmodified native Bifröst ingress.
// It is a local projection request, never a provider-dispatch authorization.
type ResponsesV2Request struct {
    RequestID string
    AttemptGroupID string
    AgentSessionID string
    WorkspaceID string
    DataClass string
    Provider string
    Model string
    Query string
    DeadlineEpochMs int64
    Body []byte
    Attestation json.RawMessage
}

type ResponsesV2Decision struct {
    Kind string `json:"kind"`
    BodyBase64 string `json:"bodyBase64,omitempty"`
    BaseBodySHA256 string `json:"baseBodySha256"`
    ProjectedBodySHA256 string `json:"projectedBodySha256,omitempty"`
    ReasonCode string `json:"reasonCode"`
}

func normalizedJSON(body []byte) (map[string]any, error) {
    d := json.NewDecoder(bytes.NewReader(body))
    d.UseNumber()
    var v map[string]any
    if err := d.Decode(&v); err != nil || v == nil {
        return nil, errors.New("native Responses body must be a JSON object")
    }
    var tail any
    if err := d.Decode(&tail); err != io.EOF {
        return nil, errors.New("native Responses body contains trailing data")
    }
    return v, nil
}

// Verify the exact native input-item chain and every top-level non-input
// setting (tools/reasoning/stream/store/opaque fields) survived unchanged.
func validateNativeResponsesProjection(original, projected []byte) error {
    before, err := normalizedJSON(original)
    if err != nil { return err }
    after, err := normalizedJSON(projected)
    if err != nil { return err }
    if before["store"] != false || after["store"] != false {
        return errors.New("Responses projection requires explicit store:false")
    }
    if before["messages"] != nil || after["messages"] != nil {
        return errors.New("Chat payload is not a native Responses request")
    }
    beforeInput, ok := before["input"]
    if !ok { return errors.New("native Responses input missing") }
    afterInput, ok := after["input"].([]any)
    if !ok { return errors.New("native Responses output must use input array") }
    var prior []any
    switch typed := beforeInput.(type) {
    case string:
        prior = []any{map[string]any{"role":"user","content":typed}}
    case []any:
        prior = typed
    default:
        return errors.New("unsupported native Responses input")
    }
    if len(afterInput) != len(prior)+1 { return errors.New("only one developer context item may be added") }
    dev, ok := afterInput[0].(map[string]any)
    if !ok || len(dev) != 2 || dev["role"] != "developer" {
        return errors.New("ACE context must be an isolated developer item")
    }
    context, ok := dev["content"].(string)
    if !ok || !strings.Contains(context, "[ACE verified context]\n") ||
        !strings.HasSuffix(context, "\n[/ACE verified context]") {
        return errors.New("ACE context lacks verified evidence markers")
    }
    for i, item := range prior {
        if !reflect.DeepEqual(item, afterInput[i+1]) {
            return errors.New("projection changed protected tool/reasoning/input item")
        }
    }
    delete(before,"input")
    delete(after,"input")
    if !reflect.DeepEqual(before,after) {
        return errors.New("projection changed protected provider parameters")
    }
    return nil
}

// Decode a bounded PREPARED decision and check all original and projected
// bytes. This is not a receipt granting permission to send to a provider.
func ApplyNativeResponses(original []byte, decision ResponsesV2Decision) ([]byte, error) {
    sum := sha256.Sum256(original)
    if decision.BaseBodySHA256 != hex.EncodeToString(sum[:]) {
        return nil, errors.New("native Responses base digest mismatch")
    }
    if decision.Kind != "PREPARED" || decision.ReasonCode != "VERIFIED_CONTEXT_ADDED" {
        return nil, errors.New("native Responses projection is not prepared")
    }
    if int64(len(decision.BodyBase64)) > 4*((DefaultMaxBodyBytes+2)/3) {
        return nil, errors.New("native projected body exceeds bound")
    }
    body, err := base64.StdEncoding.DecodeString(decision.BodyBase64)
    if err != nil || int64(len(body)) > DefaultMaxBodyBytes || base64.StdEncoding.EncodeToString(body) != decision.BodyBase64 {
        return nil, errors.New("native projected body is non-canonical or oversized")
    }
    out := sha256.Sum256(body)
    if decision.ProjectedBodySHA256 != hex.EncodeToString(out[:]) {
        return nil, errors.New("native projected digest mismatch")
    }
    if err := validateNativeResponsesProjection(original,body); err != nil { return nil, err }
    return body,nil
}

func (c Client) ProjectNativeResponses(ctx context.Context, req ResponsesV2Request) (ResponsesV2Decision, error) {
    invalid := ResponsesV2Decision{}
    if c.Endpoint == "" || c.AuthToken == "" { return invalid, errors.New("local native Responses projector is not configured") }
    if err := validateLoopbackEndpoint(c.Endpoint); err != nil { return invalid, err }
    target, err := url.Parse(c.Endpoint)
    if err != nil || target.Path != "/internal/ace-gateway/v2/project" || target.RawQuery != "" || target.Fragment != "" {
        return invalid, errors.New("native Responses projection requires the exact local v2 path")
    }
    maxBody := c.MaxBodyBytes
    if maxBody <= 0 { maxBody = DefaultMaxBodyBytes }
    if len(req.Body) == 0 || int64(len(req.Body)) > maxBody ||
        req.AgentSessionID == "" || req.WorkspaceID == "" || req.RequestID == "" ||
        req.AttemptGroupID == "" || req.Provider == "" || req.Model == "" || req.Query == "" {
        return invalid, errors.New("invalid native Responses projection identity or bounds")
    }
    if req.DeadlineEpochMs <= time.Now().UnixMilli() { return invalid, errors.New("native projection deadline elapsed") }
    if _, err := normalizedJSON(req.Body); err != nil { return invalid, err }
    var attestation map[string]json.RawMessage
    if err := json.Unmarshal(req.Attestation, &attestation); err != nil || attestation == nil {
        return invalid, errors.New("native attestation is missing")
    }
    if _,_,err := requiredAttestationBinding(attestation); err != nil { return invalid, err }
    sum := sha256.Sum256(req.Body)
    envelope := map[string]any{
        "schemaVersion": "ace.gateway.v2", "protocol": "openai.responses",
        "requestId": req.RequestID, "attemptGroupId": req.AttemptGroupID,
        "agentSessionId": req.AgentSessionID, "workspaceId": req.WorkspaceID,
        "dataClass": req.DataClass, "provider": req.Provider, "model": req.Model,
        "bodyBase64": base64.StdEncoding.EncodeToString(req.Body),
        "bodySha256": hex.EncodeToString(sum[:]), "query": req.Query,
        "projectionMode": "gateway", "deadlineEpochMs": req.DeadlineEpochMs,
        "attestation": req.Attestation,
    }
    wire, err := json.Marshal(envelope)
    if err != nil { return invalid, err }
    if int64(len(wire)) > maxEnvelopeBytes(maxBody) { return invalid, errors.New("native projection envelope exceeds bound") }
    deadline := time.Now().Add(30*time.Second)
    if d := time.UnixMilli(req.DeadlineEpochMs); d.Before(deadline) { deadline=d }
    bounded, cancel := context.WithDeadline(ctx,deadline)
    defer cancel()
    client := c.HTTPClient
    if client == nil { client = http.DefaultClient }
    safe := *client
    safe.CheckRedirect = func(*http.Request,[]*http.Request)error{return errors.New("native Responses projection redirect refused")}
    httpReq, err := http.NewRequestWithContext(bounded,http.MethodPost,c.Endpoint,bytes.NewReader(wire))
    if err != nil { return invalid, err }
    httpReq.Header.Set("Content-Type","application/json")
    httpReq.Header.Set("Authorization","Bearer "+c.AuthToken)
    response, err := safe.Do(httpReq)
    if err != nil { return invalid, fmt.Errorf("native Responses projector unavailable: %w",err) }
    defer response.Body.Close()
    if response.StatusCode != 200 { return invalid,fmt.Errorf("native Responses projector denied with HTTP %d",response.StatusCode) }
    payload,err:=io.ReadAll(io.LimitReader(response.Body,maxEnvelopeBytes(maxBody)+1))
    if err!=nil || int64(len(payload))>maxEnvelopeBytes(maxBody) { return invalid,errors.New("native Responses projector response exceeds limit") }
    d:=json.NewDecoder(bytes.NewReader(payload))
    d.DisallowUnknownFields()
    var decision ResponsesV2Decision
    if err:=d.Decode(&decision);err!=nil{return invalid,err}
    var trailing any
    if err:=d.Decode(&trailing);err!=io.EOF{return invalid,errors.New("native projection has trailing data")}
    if _,err:=ApplyNativeResponses(req.Body,decision);err!=nil{return invalid,err}
    return decision,nil
}
