//go:build bifrost_plugin

package main

import (
	"context"
	"reflect"
	"testing"

	"github.com/maximhq/bifrost/core/schemas"
)

func TestPostLLMHookPreservesNativeResponsesStreamEvents(t *testing.T) {
	ctx := schemas.NewBifrostContext(context.Background(), schemas.NoDeadline)
	defer ctx.Cancel()

	itemType := schemas.ResponsesMessageTypeFunctionCall
	itemID := "fc_stream_1"
	events := []*schemas.BifrostResponsesStreamResponse{
		{Type: schemas.ResponsesStreamResponseTypeCreated, SequenceNumber: 0},
		{
			Type:           schemas.ResponsesStreamResponseTypeOutputItemAdded,
			SequenceNumber: 1,
			Item:           &schemas.ResponsesMessage{Type: &itemType, ID: &itemID},
		},
		{
			Type:           schemas.ResponsesStreamResponseTypeFunctionCallArgumentsDelta,
			SequenceNumber: 2,
			ItemID:         &itemID,
			Delta:          schemas.Ptr(`{"path":"src/main.ts"}`),
		},
		{
			Type:           schemas.ResponsesStreamResponseTypeReasoningSummaryTextDelta,
			SequenceNumber: 3,
			Delta:          schemas.Ptr("Inspecting the requested symbol."),
		},
		{Type: schemas.ResponsesStreamResponseTypeCompleted, SequenceNumber: 4},
		{Type: schemas.ResponsesStreamResponseTypeIncomplete, SequenceNumber: 5},
		{Type: schemas.ResponsesStreamResponseTypeFailed, SequenceNumber: 6},
		{Type: schemas.ResponsesStreamResponseTypeError, SequenceNumber: 7},
	}

	for _, event := range events {
		before := *event
		response := &schemas.BifrostResponse{ResponsesStreamResponse: event}
		got, gotError, hookError := PostLLMHook(ctx, response, nil)
		if hookError != nil || gotError != nil || got != response || got.ResponsesStreamResponse != event {
			t.Fatalf("ACE post-hook must pass native stream event %q through unchanged: response=%p error=%v hookError=%v", event.Type, got, gotError, hookError)
		}
		if !reflect.DeepEqual(*event, before) {
			t.Fatalf("ACE post-hook mutated native stream event %q", event.Type)
		}
	}

	upstreamFailure := &schemas.BifrostError{Error: &schemas.ErrorField{Message: "upstream stream failed"}}
	got, gotError, hookError := PostLLMHook(ctx, nil, upstreamFailure)
	if hookError != nil || got != nil || gotError != upstreamFailure {
		t.Fatalf("ACE post-hook must preserve upstream partial/failure outcome: response=%p error=%p hookError=%v", got, gotError, hookError)
	}
}
