// drand.mjs - the public randomness of a draw (drand, League of Entropy), Official Test No. 3 onwards.
// A beacon is { round, randomness, signature }. Two facts are checked:
//   1. randomness = SHA-256( signature ): checked everywhere, with no dependency (browser and Node);
//   2. the signature is the League of Entropy's over the round: a BLS12-381 pairing check. This file carries no
//      pairing code: the caller passes an implementation (`@noble/curves/bls12-381`, MIT, pinned in the workflow).
//      Without one the signature is `insufficient`, never `verified`.
// Nothing about a chain is assumed here: its public key, genesis time and period come from the chain information
// that the workflow fetched from drand and stored beside the beacon (`/<chain hash>/info`).

import { hex, sha256, unhex } from './jcs.mjs';

/** The scheme of drand's `quicknet` chain: unchained beacons, signatures on G1, public key on G2. */
export const SCHEME = 'bls-unchained-g1-rfc9380';
const DST = 'BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_NUL_';
const HEX = /^([0-9a-f]{2})+$/;

/** A beacon whose members have the right shape, or the reason it is refused. */
export function readBeacon(value) {
  if (value === null || typeof value !== 'object') return { beacon: null, reason: 'The beacon is not a JSON object.' };
  const { round, randomness, signature } = value;
  if (!Number.isSafeInteger(round) || round < 1) return { beacon: null, reason: 'The beacon names no round.' };
  if (typeof randomness !== 'string' || !/^[0-9a-f]{64}$/.test(randomness)) return { beacon: null, reason: 'The randomness of the beacon is not 32 bytes in hexadecimal.' };
  if (typeof signature !== 'string' || !HEX.test(signature)) return { beacon: null, reason: 'The signature of the beacon is not hexadecimal.' };
  return { beacon: { round, randomness, signature }, reason: '' };
}

/** Fact 1: the randomness is the SHA-256 of the signature (so it cannot be chosen apart from the signature). */
export async function randomnessMatches(beacon) {
  return (await sha256(unhex(beacon.signature))) === beacon.randomness;
}

/** The message a round signs on an unchained chain: SHA-256 of the round number as 8 bytes, big-endian. */
export async function roundMessage(round) {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigUint64(0, BigInt(round));
  return unhex(await sha256(bytes));
}

/**
 * Both facts. `chain` is drand's chain information ({ public_key, schemeID, ... }); `bls` is the `bls12_381` object of
 * @noble/curves, or null. Returns { status, detail } with a status of pack.mjs.
 */
export async function verifyBeacon(chain, value, bls = null) {
  const { beacon, reason } = readBeacon(value);
  if (beacon === null) return { status: 'discrepancy', detail: reason };
  if (!(await randomnessMatches(beacon))) return { status: 'discrepancy', detail: `The randomness of round ${String(beacon.round)} is not the SHA-256 of its signature.` };
  if (chain === null || typeof chain !== 'object' || typeof chain.public_key !== 'string' || !HEX.test(chain.public_key)) return { status: 'insufficient', detail: 'The chain information (public key) is missing: the signature cannot be checked.' };
  if (chain.schemeID !== SCHEME) return { status: 'insufficient', detail: `The chain uses the scheme ${String(chain.schemeID)}; this code checks ${SCHEME} only.` };
  if (bls === null) return { status: 'insufficient', detail: `The randomness is the SHA-256 of the signature. The signature itself was not checked here (no pairing library): run \`node verify/cli.mjs drand <beacon.json> <chain.json>\` after \`npm install @noble/curves\`.` };
  let ok = false;
  try { ok = bls.verifyShortSignature(unhex(beacon.signature), await roundMessage(beacon.round), unhex(chain.public_key), { DST }) === true; } catch { ok = false; }
  return ok
    ? { status: 'verified', detail: `Round ${String(beacon.round)}: the signature verifies under the public key of the chain (${SCHEME}), and the randomness is its SHA-256.` }
    : { status: 'discrepancy', detail: `Round ${String(beacon.round)}: the signature does not verify under the public key of the chain.` };
}

/** For tests: a beacon signed with a throw-away key, exactly as a chain of this scheme signs a round. */
export async function signBeacon(bls, secretKey, round) {
  const signature = hex(bls.signShortSignature(await roundMessage(round), secretKey, { DST }));
  return { round, randomness: await sha256(unhex(signature)), signature };
}
