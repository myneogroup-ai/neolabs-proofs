// merkle.mjs - a Merkle tree over the rows of a test (the construction of RFC 6962: SHA-256, leaf = H(0x00 || data),
// node = H(0x01 || left || right), an odd level splits at the largest power of two). One row can then be published
// and proven to belong to the sealed set without publishing the others.

import { bytesOf, canonicalize, hex, unhex } from './jcs.mjs';

async function h(prefix, ...parts) {
  const size = 1 + parts.reduce((n, part) => n + part.length, 0);
  const data = new Uint8Array(size);
  data[0] = prefix;
  let at = 1;
  for (const part of parts) { data.set(part, at); at += part.length; }
  return new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', data));
}

export const leafHash = (data) => h(0x00, bytesOf(data));
/** The leaf of a JSON row: its RFC 8785 form. A private row adds a `salt` member kept by NEO AI. */
export const rowLeaf = (row) => leafHash(canonicalize(row));

function split(n) {
  let k = 1;
  while (k * 2 < n) k *= 2;
  return k;
}

async function rootOf(leaves) {
  if (leaves.length === 0) return new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', new Uint8Array(0)));
  if (leaves.length === 1) return leaves[0];
  const k = split(leaves.length);
  return h(0x01, await rootOf(leaves.slice(0, k)), await rootOf(leaves.slice(k)));
}

export async function merkleRoot(rows) {
  return hex(await rootOf(await Promise.all(rows.map(rowLeaf))));
}

async function pathOf(leaves, index) {
  if (leaves.length <= 1) return [];
  const k = split(leaves.length);
  return index < k
    ? [...(await pathOf(leaves.slice(0, k), index)), { side: 'right', hash: hex(await rootOf(leaves.slice(k))) }]
    : [...(await pathOf(leaves.slice(k), index - k)), { side: 'left', hash: hex(await rootOf(leaves.slice(0, k))) }];
}

/** The inclusion proof of row `index`: the sibling hashes from the leaf up to the root. */
export async function inclusionProof(rows, index) {
  const leaves = await Promise.all(rows.map(rowLeaf));
  return { index, leaves: rows.length, path: await pathOf(leaves, index) };
}

/** Whether `row` belongs to the tree of root `root`, given its inclusion proof. */
export async function verifyInclusion(row, proof, root) {
  let node = await rowLeaf(row);
  for (const step of proof.path) node = step.side === 'right' ? await h(0x01, node, unhex(step.hash)) : await h(0x01, unhex(step.hash), node);
  return hex(node) === root;
}
