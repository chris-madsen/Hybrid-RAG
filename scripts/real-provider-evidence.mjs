import { createHash, createPublicKey, verify as verifySignature } from 'node:crypto';
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const finalWireEnvelopeFields = new Set(['schemaVersion', 'payloadBase64', 'signatureBase64']);
const canonicalBase64 = (value) => typeof value === 'string'
  && /^[A-Za-z0-9+/]+={0,2}$/u.test(value)
  && Buffer.from(value, 'base64').toString('base64') === value;

// The verification key is supplied separately; signature integrity alone is not provider trust.
export const verifyFinalWireEvidenceEnvelope = (raw, verificationPublicKeyPem, evaluateEvidence) => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)
    || Object.keys(raw).some((key) => !finalWireEnvelopeFields.has(key))
    || raw.schemaVersion !== 1
    || !canonicalBase64(raw.payloadBase64)
    || typeof verificationPublicKeyPem !== 'string'
    || !verificationPublicKeyPem.includes('-----BEGIN PUBLIC KEY-----')
    || verificationPublicKeyPem.includes('PRIVATE KEY')
    || typeof evaluateEvidence !== 'function') {
    throw new Error('final-wire evidence envelope is invalid');
  }
  if (!canonicalBase64(raw.signatureBase64)) {
    throw new Error('final-wire evidence signature encoding is invalid');
  }
  const payloadBytes = Buffer.from(raw.payloadBase64, 'base64');
  const signature = Buffer.from(raw.signatureBase64, 'base64');
  if (payloadBytes.length === 0 || payloadBytes.length > 64 * 1024 || signature.length !== 64) {
    throw new Error('final-wire evidence envelope exceeds its bound or has an invalid signature');
  }
  let publicKey;
  try {
    publicKey = createPublicKey(verificationPublicKeyPem);
  } catch {
    throw new Error('final-wire verification public key is invalid');
  }
  if (publicKey.asymmetricKeyType !== 'ed25519' || !verifySignature(null, payloadBytes, publicKey, signature)) {
    throw new Error('final-wire evidence signature verification failed');
  }
  let payload;
  try {
    const payloadText = payloadBytes.toString('utf8');
    if (!Buffer.from(payloadText, 'utf8').equals(payloadBytes)) {
      throw new Error('invalid UTF-8');
    }
    payload = JSON.parse(payloadText);
  } catch {
    throw new Error('signed final-wire evidence payload is invalid JSON');
  }
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new Error('signed final-wire evidence payload must be an object');
  }
  const signerKeySha256 = createHash('sha256')
    .update(publicKey.export({ type: 'spki', format: 'der' }))
    .digest('hex');
  // A caller can sign arbitrary mock claims with its own key; that is
  // signature integrity, not an independent mock-server capture. Preserve
  // the distinction so a self-signed JSON manifest cannot certify mock wire.
  const proof = payload.evidenceKind === 'mock'
    ? { kind: 'signed-manifest-only', signerKeySha256,
      finalWireBodySha256: payload.finalWireBodySha256,
      serializedRequestSha256: payload.serializedRequestSha256 }
    : { kind: 'signed-provider-capture', signerKeySha256,
      finalWireBodySha256: payload.finalWireBodySha256,
      serializedRequestSha256: payload.serializedRequestSha256 };
  const evaluated = evaluateEvidence(payload, proof);
  if (typeof evaluated !== 'object' || evaluated === null || evaluated._tag !== 'Ok'
    || typeof evaluated.value !== 'object' || evaluated.value === null) {
    throw new Error('signed final-wire evidence does not satisfy its contract');
  }
  const receipt = evaluated.value.status === 'REAL_PROVIDER_CANDIDATE'
    && proof.kind === 'signed-provider-capture'
    ? {
      ...evaluated.value,
      reasonCodes: [...new Set([
        ...evaluated.value.reasonCodes,
        'SIGNER_IDENTITY_NOT_OPERATOR_PINNED',
        'CURRENT_RUNTIME_IDENTITY_NOT_BOUND',
      ])],
    }
    : evaluated.value;
  return { payload, proof, receipt };
};

export const stopAndRetainProviderTraces = async (providers, outputDirectory) => {
  await Promise.all(providers.map(async (provider) => provider.stop?.()));
  if (outputDirectory !== undefined) await mkdir(outputDirectory, { recursive: true });

  const digests = {};
  for (const provider of providers) {
    if (!/^[a-z0-9-]+$/u.test(provider.label)) {
      throw new Error(`invalid provider trace label: ${provider.label}`);
    }
    try {
      const bytes = await readFile(provider.traceFile);
      digests[provider.label] = createHash('sha256').update(bytes).digest('hex');
      if (outputDirectory !== undefined) {
        await copyFile(provider.traceFile, join(outputDirectory, `${provider.label}-provider-trace.jsonl`));
      }
    } catch (cause) {
      if (cause?.code !== 'ENOENT') throw cause;
      digests[provider.label] = undefined;
    }
  }
  return digests;
};

const hermesHiddenStateFields = new Set([
  'previous_response_id', 'conversation', 'conversation_id', 'thread_id',
]);
const hermesSessionContentFields = new Set([
  'content', 'tool_calls', 'reasoning', 'reasoning_content', 'reasoning_details', 'codex_reasoning_items',
]);
const jsonObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const safeIdentifier = (value) => typeof value === 'string' && value.trim().length > 0 && value.length <= 4096;
const digestIdentifier = (value) => createHash('sha256').update(`hermes-agent-loop:${value}`, 'utf8').digest('hex');

const containsHiddenProviderState = (value, depth = 0) => {
  if (depth > 12) return jsonObject(value) || Array.isArray(value);
  if (Array.isArray(value)) return value.some((child) => containsHiddenProviderState(child, depth + 1));
  if (!jsonObject(value)) return false;
  for (const [key, child] of Object.entries(value)) {
    if (hermesHiddenStateFields.has(key)) return true;
    if (!hermesSessionContentFields.has(key) && containsHiddenProviderState(child, depth + 1)) return true;
  }
  return false;
};

const sessionToolCalls = (message) => {
  const value = message.tool_calls;
  if (value === undefined || value === null) return [];
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new Error('Hermes session export contains malformed tool-call metadata');
    }
  }
  if (!Array.isArray(parsed)) throw new Error('Hermes session export contains unsupported tool-call metadata');
  return parsed.map((call) => {
    if (!jsonObject(call) || !safeIdentifier(call.id)) {
      throw new Error('Hermes session export contains a tool call without a stable ID');
    }
    return call.id;
  });
};

/**
 * Reduce Hermes's pinned JSONL session export to safe structural evidence.
 * The raw transcript is hashed but never returned or copied into the redacted index.
 */
export const summarizeHermesSessionExport = (rawBytes) => {
  const bytes = Buffer.from(rawBytes);
  if (bytes.length === 0 || bytes.length > 64 * 1024 * 1024) {
    throw new Error('Hermes session export is empty or exceeds the evidence parser bound');
  }
  const text = bytes.toString('utf8');
  if (!Buffer.from(text, 'utf8').equals(bytes)) throw new Error('Hermes session export is not valid UTF-8');
  const rows = text.split(/\r?\n/u).filter((line) => line.trim().length > 0);
  if (rows.length !== 1) throw new Error('Hermes session export must contain exactly one isolated session record');
  let session;
  try {
    session = JSON.parse(rows[0]);
  } catch {
    throw new Error('Hermes session export is malformed JSONL');
  }
  const sessionId = jsonObject(session) ? session.id ?? session.session_id : undefined;
  if (!jsonObject(session) || !safeIdentifier(sessionId) || !Array.isArray(session.messages)) {
    throw new Error('Hermes session export lacks a session identity or message list');
  }

  const messageCounts = { user: 0, assistant: 0, tool: 0, system: 0, other: 0 };
  const toolCallIds = [];
  const toolResultIds = [];
  const pendingToolCalls = new Set();
  let validToolEventOrder = true;
  let lastCompletedToolResultAt = -1;
  let lastAssistantAt = -1;
  let reasoningMessages = 0;
  let hiddenProviderStatePresent = containsHiddenProviderState({
    ...session,
    messages: session.messages.map((message) => {
      if (!jsonObject(message)) return message;
      const { content, tool_calls, reasoning, reasoning_content, reasoning_details, codex_reasoning_items, ...metadata } = message;
      void content;
      void tool_calls;
      void reasoning;
      void reasoning_content;
      void reasoning_details;
      void codex_reasoning_items;
      return metadata;
    }),
  });

  for (const [messageIndex, message] of session.messages.entries()) {
    if (!jsonObject(message) || typeof message.role !== 'string') {
      messageCounts.other += 1;
      continue;
    }
    if (message.role === 'user') messageCounts.user += 1;
    else if (message.role === 'assistant') {
      messageCounts.assistant += 1;
      if (message.reasoning !== undefined || message.reasoning_content !== undefined
        || message.reasoning_details !== undefined || message.codex_reasoning_items !== undefined) reasoningMessages += 1;
      lastAssistantAt = messageIndex;
      const calls = sessionToolCalls(message);
      for (const id of calls) {
        if (pendingToolCalls.has(id) || toolCallIds.includes(id)) validToolEventOrder = false;
        pendingToolCalls.add(id);
        toolCallIds.push(id);
      }
    } else if (message.role === 'tool') {
      messageCounts.tool += 1;
      if (safeIdentifier(message.tool_call_id)) {
        toolResultIds.push(message.tool_call_id);
        if (!pendingToolCalls.delete(message.tool_call_id)) validToolEventOrder = false;
        else lastCompletedToolResultAt = messageIndex;
      } else {
        validToolEventOrder = false;
      }
    } else if (message.role === 'system') messageCounts.system += 1;
    else messageCounts.other += 1;
    if (containsHiddenProviderState(message)) hiddenProviderStatePresent = true;
  }

  const uniqueToolCalls = new Set(toolCallIds);
  const uniqueToolResults = new Set(toolResultIds);
  const matchedToolIds = [...uniqueToolCalls].filter((id) => uniqueToolResults.has(id));
  const toolLoopStatus = messageCounts.user > 0 && messageCounts.assistant >= 2
    && uniqueToolCalls.size > 0 && uniqueToolCalls.size === toolCallIds.length
    && uniqueToolResults.size === toolResultIds.length
    && matchedToolIds.length === uniqueToolCalls.size
    && matchedToolIds.length === uniqueToolResults.size
    && validToolEventOrder && pendingToolCalls.size === 0
    && lastAssistantAt > lastCompletedToolResultAt
    ? 'complete' : 'incomplete';

  return {
    schemaVersion: 1,
    evidenceKind: 'hermes-session-export-unattested',
    rawTraceSha256: createHash('sha256').update(bytes).digest('hex'),
    rawTraceBytes: bytes.length,
    sessionIdSha256: digestIdentifier(sessionId),
    messageCounts,
    reasoningMessages,
    toolCallCount: toolCallIds.length,
    toolResultCount: toolResultIds.length,
    matchedToolCallIdSha256: matchedToolIds.map(digestIdentifier).sort(),
    unmatchedToolCallIdSha256: [...uniqueToolCalls].filter((id) => !uniqueToolResults.has(id)).map(digestIdentifier).sort(),
    unmatchedToolResultIdSha256: [...uniqueToolResults].filter((id) => !uniqueToolCalls.has(id)).map(digestIdentifier).sort(),
    toolLoopStatus,
    hiddenProviderState: hiddenProviderStatePresent ? 'present' : 'not_observable',
    hostTranscriptAttested: false,
    streamingTerminalObserved: false,
  };
};

/**
 * Correlate sanitized Hermes export structure with Gateway request IDs and
 * signature-checked C05 receipt summaries. This can produce only NOT_RUN,
 * BLOCKED, or CANDIDATE; it deliberately has no accepted/pass state.
 */
export const evaluateHermesAgentLoopEvidence = (input) => {
  const summary = input?.sessionSummary;
  if (!jsonObject(summary) || summary.schemaVersion !== 1
    || summary.evidenceKind !== 'hermes-session-export-unattested'
    || !/^[a-f0-9]{64}$/u.test(summary.rawTraceSha256)
    || !/^[a-f0-9]{64}$/u.test(summary.sessionIdSha256)) {
    return { schemaVersion: 1, status: 'BLOCKED', reasonCodes: ['HERMES_SESSION_SUMMARY_INVALID'] };
  }
  const reasonCodes = new Set([
    'SESSION_EXPORT_NOT_INDEPENDENTLY_ATTESTED',
    'HOST_TRANSCRIPT_AND_COMPACTION_UNATTESTED',
    'STREAM_TERMINAL_AND_CANCELLATION_NOT_OBSERVED',
    'TASK_OUTCOME_NOT_INDEPENDENTLY_CHECKED',
  ]);
  if (summary.hiddenProviderState === 'present') {
    reasonCodes.add('HIDDEN_PROVIDER_STATE_PRESENT');
    return { schemaVersion: 1, status: 'BLOCKED', sessionIdSha256: summary.sessionIdSha256,
      rawTraceSha256: summary.rawTraceSha256, reasonCodes: [...reasonCodes].sort() };
  }
  if (summary.toolLoopStatus !== 'complete') {
    reasonCodes.add('TOOL_CALL_RESULT_LINK_MISSING');
    return { schemaVersion: 1, status: 'BLOCKED', sessionIdSha256: summary.sessionIdSha256,
      rawTraceSha256: summary.rawTraceSha256, reasonCodes: [...reasonCodes].sort() };
  }
  if (input?.taskOutcome === 'fail') {
    reasonCodes.add('TASK_OUTCOME_FAILED');
    return { schemaVersion: 1, status: 'BLOCKED', sessionIdSha256: summary.sessionIdSha256,
      rawTraceSha256: summary.rawTraceSha256, reasonCodes: [...reasonCodes].sort() };
  }

  const gatewayRequests = input?.gatewayRequests;
  if (!Array.isArray(gatewayRequests) || gatewayRequests.length === 0) {
    reasonCodes.add('GATEWAY_PROJECTION_NOT_OBSERVED');
    return { schemaVersion: 1, status: 'NOT_RUN', sessionIdSha256: summary.sessionIdSha256,
      rawTraceSha256: summary.rawTraceSha256, reasonCodes: [...reasonCodes].sort() };
  }
  const requestIds = new Set();
  let boundGatewayRequests = 0;
  for (const request of gatewayRequests) {
    if (!jsonObject(request) || request.kind !== 'PREPARED'
      || !/^ace-[a-f0-9]{32}$/u.test(request.requestId)
      || requestIds.has(request.requestId)) {
      reasonCodes.add(request?.kind === 'BLOCK' ? 'GATEWAY_PROJECTION_BLOCKED' : 'GATEWAY_REQUEST_ID_INVALID_OR_DUPLICATE');
      return { schemaVersion: 1, status: 'BLOCKED', sessionIdSha256: summary.sessionIdSha256,
        rawTraceSha256: summary.rawTraceSha256, reasonCodes: [...reasonCodes].sort() };
    }
    requestIds.add(request.requestId);
    if (safeIdentifier(request.agentSessionId)) {
      boundGatewayRequests += 1;
      if (digestIdentifier(request.agentSessionId) !== summary.sessionIdSha256) {
        reasonCodes.add('CALLER_ASSERTED_SESSION_ID_MISMATCH');
        return { schemaVersion: 1, status: 'BLOCKED', sessionIdSha256: summary.sessionIdSha256,
          rawTraceSha256: summary.rawTraceSha256, reasonCodes: [...reasonCodes].sort() };
      }
    }
  }
  if (boundGatewayRequests !== requestIds.size) {
    reasonCodes.add('SESSION_CORRELATION_NOT_OBSERVED');
    return { schemaVersion: 1, status: 'NOT_RUN', sessionIdSha256: summary.sessionIdSha256,
      rawTraceSha256: summary.rawTraceSha256, gatewayRequestCount: requestIds.size,
      sessionCorrelation: 'not_observed', reasonCodes: [...reasonCodes].sort() };
  }
  reasonCodes.add('CALLER_ASSERTED_SESSION_CORRELATION_ONLY');

  const receipts = input?.signatureCheckedFinalWireReceipts;
  if (!Array.isArray(receipts) || receipts.length === 0) {
    reasonCodes.add('FINAL_WIRE_RECEIPTS_NOT_RUN');
    return { schemaVersion: 1, status: 'NOT_RUN', sessionIdSha256: summary.sessionIdSha256,
      rawTraceSha256: summary.rawTraceSha256, gatewayRequestCount: requestIds.size,
      reasonCodes: [...reasonCodes].sort() };
  }
  const receiptByRequestId = new Map();
  for (const receipt of receipts) {
    if (!jsonObject(receipt) || typeof receipt.requestId !== 'string' || receipt.requestId.length === 0
      || receiptByRequestId.has(receipt.requestId)) {
      reasonCodes.add('FINAL_WIRE_RECEIPT_INVALID_OR_DUPLICATE');
      return { schemaVersion: 1, status: 'BLOCKED', sessionIdSha256: summary.sessionIdSha256,
        rawTraceSha256: summary.rawTraceSha256, gatewayRequestCount: requestIds.size,
        reasonCodes: [...reasonCodes].sort() };
    }
    receiptByRequestId.set(receipt.requestId, receipt);
    if (receipt.status === 'MOCK_WIRE_VERIFIED'
      || receipt.providerAcknowledgement?.kind === 'mock') {
      reasonCodes.add('MOCK_RECEIPT_CANNOT_CERTIFY_REAL_AGENT');
      return { schemaVersion: 1, status: 'BLOCKED', sessionIdSha256: summary.sessionIdSha256,
        rawTraceSha256: summary.rawTraceSha256, gatewayRequestCount: requestIds.size,
        reasonCodes: [...reasonCodes].sort() };
    }
  }
  const missingRequests = [...requestIds].filter((requestId) => !receiptByRequestId.has(requestId));
  if (missingRequests.length > 0) {
    reasonCodes.add('FINAL_WIRE_RECEIPT_LINK_MISSING');
    return { schemaVersion: 1, status: 'NOT_RUN', sessionIdSha256: summary.sessionIdSha256,
      rawTraceSha256: summary.rawTraceSha256, gatewayRequestIds: [...requestIds].sort(),
      gatewayRequestCount: requestIds.size,
      linkedFinalWireReceiptCount: requestIds.size - missingRequests.length,
      reasonCodes: [...reasonCodes].sort() };
  }
  if ([...receiptByRequestId.keys()].some((requestId) => !requestIds.has(requestId))) {
    reasonCodes.add('FINAL_WIRE_RECEIPT_NOT_BOUND_TO_GATEWAY_REQUEST');
    return { schemaVersion: 1, status: 'BLOCKED', sessionIdSha256: summary.sessionIdSha256,
      rawTraceSha256: summary.rawTraceSha256, gatewayRequestCount: requestIds.size,
      reasonCodes: [...reasonCodes].sort() };
  }
  const candidateReceipts = [...requestIds].every((requestId) => {
    const receipt = receiptByRequestId.get(requestId);
    return receipt?.status === 'REAL_PROVIDER_CANDIDATE'
      && receipt.providerAcknowledgement?.kind === 'real_provider'
      && Number.isSafeInteger(receipt.providerAcknowledgement.statusCode)
      && receipt.providerAcknowledgement.statusCode >= 200
      && receipt.providerAcknowledgement.statusCode < 300;
  });
  if (!candidateReceipts) {
    reasonCodes.add('FINAL_WIRE_RECEIPT_NOT_CERTIFIED');
    return { schemaVersion: 1, status: 'BLOCKED', sessionIdSha256: summary.sessionIdSha256,
      rawTraceSha256: summary.rawTraceSha256, gatewayRequestCount: requestIds.size,
      reasonCodes: [...reasonCodes].sort() };
  }
  reasonCodes.add('REAL_PROVIDER_RECEIPTS_REMAIN_CANDIDATES');
  const finalWireReceiptSummaries = [...requestIds].sort().map((requestId) => {
    const receipt = receiptByRequestId.get(requestId);
    const acknowledgement = receipt.providerAcknowledgement;
    return {
      requestId,
      attemptId: receipt.attemptId,
      status: receipt.status,
      sourceCommit: receipt.sourceCommit,
      bifrostCommit: receipt.bifrostCommit,
      bifrostPluginSha256: receipt.bifrostPluginSha256,
      aceRuntimeSha256: receipt.aceRuntimeSha256,
      pluginOrderSha256: receipt.pluginOrderSha256,
      protocol: receipt.protocol,
      provider: receipt.provider,
      model: receipt.model,
      acknowledgementKind: acknowledgement.kind,
      acknowledgementStatusCode: acknowledgement.statusCode,
      providerRequestIdSha256: digestIdentifier(acknowledgement.providerRequestId),
    };
  });
  return {
    schemaVersion: 1,
    status: 'CANDIDATE',
    sessionIdSha256: summary.sessionIdSha256,
    rawTraceSha256: summary.rawTraceSha256,
    sessionCorrelation: 'caller_asserted_match',
    gatewayRequestIds: [...requestIds].sort(),
    gatewayRequestCount: requestIds.size,
    linkedFinalWireReceiptCount: requestIds.size,
    finalWireReceiptSummaries,
    taskOutcomeObserved: input?.taskOutcome === 'pass' || input?.taskOutcome === 'fail',
    hostTranscriptAttested: false,
    reasonCodes: [...reasonCodes].sort(),
  };
};
