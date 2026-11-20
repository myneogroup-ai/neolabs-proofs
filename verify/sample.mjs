// sample.mjs - the public random sample of a campaign (Official Test No. 3 onwards).
// Before the campaign: the protocol fixes the list of scenarios (or its fingerprint), the sample size and a FUTURE
// round of the drand beacon (League of Entropy). After the campaign: the results are frozen, the Merkle root is
// time-stamped, and only then is the round published by drand. The sample is the `size` scenarios with the smallest
// SHA-256( randomness || ":" || scenario id ): anyone recomputes it from the round's public randomness.

import { sha256 } from './jcs.mjs';

export async function drawSample(scenarioIds, randomnessHex, size) {
  if (!/^[0-9a-f]{64}$/.test(randomnessHex)) throw new TypeError('the randomness of a drand round is 32 bytes in hexadecimal');
  const keyed = await Promise.all([...new Set(scenarioIds)].map(async (id) => ({ id, key: await sha256(`${randomnessHex}:${id}`) })));
  return keyed.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.id < b.id ? -1 : 1)).slice(0, size).map((entry) => entry.id);
}

/** The conditions of the draw: the root must be time-stamped BEFORE the round is published. */
export function drawConditions({ root_timestamp, round_time }) {
  const stamped = Date.parse(root_timestamp);
  const round = Date.parse(round_time);
  if (!Number.isFinite(stamped) || !Number.isFinite(round)) return { met: false, reason: 'A time is missing: the conditions of the draw cannot be shown as met.' };
  return stamped < round ? { met: true, reason: `The root was time-stamped at ${root_timestamp}, before round time ${round_time}.` } : { met: false, reason: `The root was time-stamped at ${root_timestamp}, not before round time ${round_time}: the conditions of the draw were not met.` };
}

/** The time of a drand round from the chain information (genesis_time and period, in seconds). */
export function roundTime(chain, round) {
  return new Date((chain.genesis_time + (round - 1) * chain.period) * 1000).toISOString();
}
