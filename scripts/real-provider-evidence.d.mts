import type {
  NativeResponsesFinalWireProof,
  NativeResponsesFinalWireReceipt,
} from '../src/domain/provider-trace-receipt.js';

export type VerifiedFinalWireReceipt = NativeResponsesFinalWireReceipt;

export declare function verifyFinalWireEvidenceEnvelope(
  raw: unknown,
  verificationPublicKeyPem: string,
  evaluateEvidence: (
    payload: unknown,
    proof: NativeResponsesFinalWireProof,
  ) => Readonly<{ _tag: 'Ok'; value: NativeResponsesFinalWireReceipt } | { _tag: 'Err'; error: unknown }>,
): Readonly<{
  payload: unknown;
  proof: NativeResponsesFinalWireProof;
  receipt: VerifiedFinalWireReceipt;
}>;
