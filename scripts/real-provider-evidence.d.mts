import type {
  NativeResponsesFinalWireProof,
  NativeResponsesFinalWireReceipt,
} from '../src/domain/provider-trace-receipt.js';

export type VerifiedFinalWireReceipt = Omit<NativeResponsesFinalWireReceipt, 'status'> & Readonly<{
  status: NativeResponsesFinalWireReceipt['status'] | 'REAL_PROVIDER_WIRE_VERIFIED';
}>;

export declare function verifyFinalWireEvidenceEnvelope(
  raw: unknown,
  trustedPublicKeyPem: string,
  evaluateEvidence: (
    payload: unknown,
    proof: NativeResponsesFinalWireProof,
  ) => Readonly<{ _tag: 'Ok'; value: NativeResponsesFinalWireReceipt } | { _tag: 'Err'; error: unknown }>,
): Readonly<{
  payload: unknown;
  proof: NativeResponsesFinalWireProof;
  receipt: VerifiedFinalWireReceipt;
}>;
