// The NEOLABS evidence pack (ADR-0092): the manifest, the recomputation and every state a check can show.
// A synthetic campaign only: no real result, no network, no model call, no inference key.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canonicalize, sha256 } from '../jcs.mjs';
import { inclusionProof, merkleRoot, verifyInclusion } from '../merkle.mjs';
import { INDEX_SCHEMA, buildManifest, checkPack, ledgerHash, manifestDigest, publicationPlan, summary, withProof } from '../pack.mjs';
import { drawConditions, drawSample, roundTime } from '../sample.mjs';
import { score } from '../score.mjs';
import { seededRandom } from '../stats.mjs';

const enc = new TextEncoder();
const SYSTEMS = ['profile:auto', 'profile:auto.fast', 'model:model:example/ref-a@2026-01-01', 'model:model:example/ref-b@2026-01-01'];

function campaign() {
  const random = seededRandom('fixture');
  const rows = [];
  for (let t = 1; t <= 14; t += 1) {
    for (const system of SYSTEMS) {
      const base = system === 'profile:auto' ? 8.6 : system.startsWith('model:') ? 8.2 : 6;
      const one = Math.max(1, Math.min(10, Math.round(base + (random() - 0.5) * 3)));
      rows.push({ task_id: `t${String(t).padStart(2, '0')}`, class: 'analysis', language: 'en', current_events: false, system, status: 'completed', streamed: true, first_token_ms: 900, total_ms: Math.round((system.startsWith('profile:') ? 4000 : 20000) * (0.6 + random())), cost_micro_usd: Math.round((system.startsWith('profile:') ? 9000 : 80000) * (0.5 + random())), price_verified: true, exact_match: null, scores: random() < 0.85 ? [one, Math.max(1, one - 1)] : [one] });
    }
  }
  return { schema: 'neolabs.public-results/1', lab_run_id: 'fixture', seed: 'abcdef0123456789', task_set_version: 'fixture-1', started_at: '2026-01-01T10:00:00.000Z', finished_at: '2026-01-01T11:00:00.000Z', systems: SYSTEMS.map((id) => ({ id, kind: id.startsWith('profile:') ? 'profile' : 'model', label: id })), rows };
}

async function pack(change = {}) {
  const results = campaign();
  const entry = { seq: 7, id: 'e-7', at: '2026-01-01T11:00:01.000Z', kind: 'lab.campaign', account_id: 'a', actor_id: 'a', run_id: null, conversation_id: null, message_id: null, payload: { lab_run_id: 'fixture', answers: results.rows.length }, prev_hash: 'f'.repeat(64) };
  entry.hash = await ledgerHash(entry);
  const token = new Uint8Array([0x30, 0x82, ...Uint8Array.from(entry.hash.match(/../g).map((b) => Number.parseInt(b, 16))), 0x02, 0x01]);
  const files = new Map([
    ['results.json', enc.encode(`${canonicalize(results)}\n`)],
    ['ledger-entry-7.json', enc.encode(JSON.stringify(entry))],
    ['ledger-7.tsr', token],
    ['report.pdf', enc.encode('%PDF-1.7 fixture')],
  ]);
  const manifest = await buildManifest({
    test: { id: 'fixture', number: 0, title: 'Fixture' },
    campaign: { lab_run_id: 'fixture', declared_started_at: results.started_at, declared_finished_at: results.finished_at, seed: results.seed, task_set_version: results.task_set_version },
    versions: { lili: { commit: 'abc1234' }, protocol: 'fixture', scorer: { name: 'neolabs/verify', version: '1' }, rubric: 'fixture' },
    files: [...files].map(([path, bytes]) => ({ path, role: path, bytes })),
    results,
    ledger: { entry: 7, hash: entry.hash, file: 'ledger-entry-7.json' },
    timestamps: [{ authority: 'Fixture TSA', standard: 'RFC 3161', file: 'ledger-7.tsr', covers: 'the hash of ledger entry no. 7', imprint_sha256: entry.hash, time: '2026-01-01T11:00:02Z', verify_command: 'openssl ts -verify ...' }],
    costs: { computed: { scope: 'Inference cost per answer' }, reconciled: null, reconciliation_limit: 'Provider invoices are monthly and per organisation: the cost of this campaign cannot be attributed from them.', out_of_scope: ['Infrastructure'] },
    limits: [],
    generated_at: '2026-01-02T00:00:00.000Z',
    ...change.manifest,
  });
  const digest = await manifestDigest(manifest);
  files.set('manifest.json', enc.encode(JSON.stringify(manifest, null, 2)));
  files.set('publication-index.json', enc.encode(JSON.stringify({ schema: INDEX_SCHEMA, manifest_sha256: digest, updated_at: '2026-01-02T00:00:00.000Z', proofs: change.proofs ? change.proofs(digest) : [] })));
  return { files, manifest, digest, results };
}
const reader = (files) => async (path) => files.get(path) ?? null;
const statusOf = (checks, id) => checks.find((check) => check.id === id)?.status;

test('RFC 8785: members sorted by code unit, ECMAScript numbers, no white space', () => {
  assert.equal(canonicalize({ b: [1, 1.5, 1e21, 0.000001, -0], a: { '\u20ac': 'x', '\r': null, 1: true }, c: 'a"\n' }), '{"a":{"\\r":null,"1":true,"\u20ac":"x"},"b":[1,1.5,1e+21,0.000001,0],"c":"a\\"\\n"}');
  assert.throws(() => canonicalize({ a: Number.NaN }));
  assert.equal(canonicalize({ a: 1, b: undefined }), '{"a":1}');
});

test('a valid pack: every public check passes, what is not public says so, and nothing is a discrepancy', async () => {
  const { files, digest } = await pack();
  const { manifest_sha256, checks } = await checkPack(reader(files));
  assert.equal(manifest_sha256, digest);
  for (const id of ['files', 'index', 'rows', 'merkle', 'scores', 'ledger', 'ts:ledger-7.tsr', 'cost-computed']) assert.equal(statusOf(checks, id), 'verified', id);
  assert.equal(statusOf(checks, 'ts-sig:ledger-7.tsr'), 'insufficient');
  assert.equal(statusOf(checks, 'ledger-digest'), 'insufficient');
  assert.equal(statusOf(checks, 'cost-invoices'), 'insufficient', 'a cost that cannot be attributed to the test shows its limit');
  assert.equal(statusOf(checks, 'protocol'), 'not_applicable');
  assert.equal(statusOf(checks, 'sample'), 'not_applicable');
  assert.equal(summary(checks).ok, true);
});

test('a modified file and a missing file are discrepancies, named', async () => {
  const changed = await pack();
  changed.files.set('report.pdf', enc.encode('%PDF-1.7 other'));
  assert.equal(statusOf((await checkPack(reader(changed.files))).checks, 'file:report.pdf'), 'discrepancy');
  const missing = await pack();
  missing.files.delete('ledger-7.tsr');
  const { checks } = await checkPack(reader(missing.files));
  assert.equal(statusOf(checks, 'file:ledger-7.tsr'), 'discrepancy');
  assert.equal(summary(checks).ok, false);
});

test('a score that differs from the recomputation, a row removed, a row altered: discrepancies', async () => {
  const lifted = await pack();
  const manifest = structuredClone(lifted.manifest);
  manifest.metrics.published.systems['profile:auto'].quality.value += 0.4;
  lifted.files.set('manifest.json', enc.encode(JSON.stringify(manifest)));
  let checks = (await checkPack(reader(lifted.files))).checks;
  assert.equal(statusOf(checks, 'scores'), 'discrepancy');
  assert.match(checks.find((check) => check.id === 'scores').detail, /profile:auto\.quality\.value/);
  assert.equal(statusOf(checks, 'index'), 'discrepancy', 'an edited manifest is no longer the manifest the index names');

  const removed = await pack();
  const fewer = { ...removed.results, rows: removed.results.rows.slice(1) };
  removed.files.set('results.json', enc.encode(`${canonicalize(fewer)}\n`));
  checks = (await checkPack(reader(removed.files))).checks;
  assert.equal(statusOf(checks, 'rows'), 'discrepancy');
  assert.equal(statusOf(checks, 'merkle'), 'discrepancy');
  assert.equal(statusOf(checks, 'file:results.json'), 'discrepancy');
});

test('an altered ledger entry and a token for another fingerprint are discrepancies', async () => {
  const altered = await pack();
  const entry = JSON.parse(new TextDecoder().decode(altered.files.get('ledger-entry-7.json')));
  entry.payload.answers += 1;
  altered.files.set('ledger-entry-7.json', enc.encode(JSON.stringify(entry)));
  assert.equal(statusOf((await checkPack(reader(altered.files))).checks, 'ledger'), 'discrepancy');
  const other = await pack();
  other.files.set('ledger-7.tsr', new Uint8Array(40).fill(7));
  assert.equal(statusOf((await checkPack(reader(other.files))).checks, 'ts:ledger-7.tsr'), 'discrepancy');
});

test('external proofs keep their real state: pending, verified, a signature file for another manifest, a wrong DOI', async () => {
  const proofs = (digest) => [
    { provider: 'OpenTimestamps', group: 'date', status: 'pending', detail: 'Awaiting confirmation in a Bitcoin block.', file: 'manifest.ots' },
    { provider: 'FreeTSA', group: 'date', status: 'verified', file: 'freetsa.tsr', must_contain_manifest_digest: true },
    { provider: 'Sigstore', group: 'integrity', status: 'verified', file: 'manifest.sigstore.json', kind: 'sigstore-bundle' },
    { provider: 'Zenodo and DataCite', group: 'downloads', status: 'verified', file: 'datacite.json', doi: '10.5072/zenodo.111', must_name_manifest_digest: true, url: 'https://doi.org/10.5072/zenodo.111' },
    { provider: 'Software Heritage', group: 'provenance', status: 'insufficient', detail: 'Not configured: the public repository does not exist yet.' },
    { digest },
  ].slice(0, 5);
  const good = await pack({ proofs });
  const raw = Uint8Array.from(good.digest.match(/../g).map((b) => Number.parseInt(b, 16)));
  good.files.set('manifest.ots', new Uint8Array([0, 0x4f, 0x70, 0x65, 0x6e]));
  good.files.set('freetsa.tsr', new Uint8Array([0x30, ...raw, 0x01]));
  good.files.set('manifest.sigstore.json', enc.encode(JSON.stringify({ messageSignature: { messageDigest: { algorithm: 'SHA2_256', digest: Buffer.from(raw).toString('base64') }, signature: 'x' } })));
  good.files.set('datacite.json', enc.encode(JSON.stringify({ data: { id: '10.5072/zenodo.111', attributes: { descriptions: [{ description: `manifest ${good.digest}` }] } } })));
  let checks = (await checkPack(reader(good.files))).checks;
  assert.equal(statusOf(checks, 'ext:OpenTimestamps'), 'pending');
  assert.equal(statusOf(checks, 'ext:FreeTSA'), 'verified');
  assert.equal(statusOf(checks, 'ext:Sigstore'), 'verified');
  assert.equal(statusOf(checks, 'ext:Zenodo and DataCite'), 'verified');
  assert.equal(statusOf(checks, 'ext:Software Heritage'), 'insufficient');
  assert.equal(summary(checks).ok, true, 'a pending proof is not a failure');

  good.files.set('manifest.sigstore.json', enc.encode(JSON.stringify({ messageSignature: { messageDigest: { algorithm: 'SHA2_256', digest: Buffer.alloc(32).toString('base64') } } })));
  good.files.set('datacite.json', enc.encode(JSON.stringify({ data: { id: '10.5072/zenodo.999', attributes: { descriptions: [{ description: `manifest ${good.digest}` }] } } })));
  good.files.set('freetsa.tsr', new Uint8Array(40));
  checks = (await checkPack(reader(good.files))).checks;
  assert.equal(statusOf(checks, 'ext:Sigstore'), 'discrepancy', 'a signature of another manifest');
  good.files.set('manifest.sigstore.json', enc.encode(JSON.stringify({ verificationMaterial: { tlogEntries: [{ canonicalizedBody: Buffer.from(JSON.stringify({ kind: 'hashedrekord', spec: { data: { hash: { algorithm: 'sha256', value: good.digest } } } })).toString('base64') }] }, messageSignature: { signature: 'x' } })));
  assert.equal(statusOf((await checkPack(reader(good.files))).checks, 'ext:Sigstore'), 'verified', 'a bundle that names the manifest in its Rekor entry');
  assert.equal(statusOf(checks, 'ext:Zenodo and DataCite'), 'discrepancy', 'a DOI that is not the one recorded');
  assert.equal(statusOf(checks, 'ext:FreeTSA'), 'discrepancy');
});

test('a provider is never published twice for one manifest; a pending proof is followed, not created again', async () => {
  const { digest } = await pack();
  let index = null;
  assert.equal(publicationPlan(index, 'Zenodo and DataCite', digest), 'create');
  index = withProof(index, digest, { provider: 'Zenodo and DataCite', status: 'pending', external_id: 'deposition-42' }, '2026-01-02T00:00:00Z');
  assert.equal(publicationPlan(index, 'Zenodo and DataCite', digest), 'follow', 'after a provider failure the same deposition is resumed');
  index = withProof(index, digest, { provider: 'Zenodo and DataCite', status: 'verified', doi: '10.5072/zenodo.42', url: 'https://doi.org/10.5072/zenodo.42' }, '2026-01-02T01:00:00Z');
  assert.equal(publicationPlan(index, 'Zenodo and DataCite', digest), 'skip');
  assert.equal(index.proofs.length, 1);
  assert.equal(publicationPlan(index, 'Zenodo and DataCite', 'e'.repeat(64)), 'create', 'a corrected report is a new manifest: a new version, linked to the previous one');
});

test('a Merkle inclusion proof binds one row to the sealed root, and only that row', async () => {
  const { results, manifest } = await pack();
  const root = await merkleRoot(results.rows);
  assert.equal(root, manifest.results.merkle.root);
  for (const index of [0, 13, results.rows.length - 1]) {
    const proof = await inclusionProof(results.rows, index);
    assert.equal(await verifyInclusion(results.rows[index], proof, root), true);
    assert.equal(await verifyInclusion({ ...results.rows[index], cost_micro_usd: 1 }, proof, root), false);
  }
});

test('the public sample: reproducible from the drand round, and void when the root was stamped too late', async () => {
  const ids = Array.from({ length: 34 }, (_, i) => `a${String(i + 1).padStart(2, '0')}`);
  const randomness = await sha256('round 123');
  const sample = await drawSample(ids, randomness, 5);
  assert.equal(sample.length, 5);
  assert.deepEqual(await drawSample([...ids].reverse(), randomness, 5), sample, 'the order of the list does not matter');
  assert.notDeepEqual(await drawSample(ids, await sha256('round 124'), 5), sample);
  const chain = { genesis_time: 1692803367, period: 3 };
  const time = roundTime(chain, 1000);
  assert.equal(drawConditions({ root_timestamp: new Date(Date.parse(time) - 60000).toISOString(), round_time: time }).met, true);
  assert.equal(drawConditions({ root_timestamp: new Date(Date.parse(time) + 1000).toISOString(), round_time: time }).met, false);
});

test('the scorer is deterministic and counts what the judging covered', () => {
  const a = score(campaign());
  assert.deepEqual(score(campaign()), a);
  assert.equal(a.comparisons, 16);
  assert.equal(a.judging.answers, 56);
  assert.ok(a.judging.answers_with_two_scores > 30);
  assert.ok(a.claims.some((claim) => claim.measure === 'cost' && claim.supported));
});
