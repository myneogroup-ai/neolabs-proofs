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
  good.files.set('manifest.sigstore.json', enc.encode(JSON.stringify({ base64Signature: 'x', cert: 'y', rekorBundle: { Payload: { body: Buffer.from(JSON.stringify({ kind: 'hashedrekord', spec: { data: { hash: { algorithm: 'sha256', value: good.digest } } } })).toString('base64'), logIndex: 1 } } })));
  assert.equal(statusOf((await checkPack(reader(good.files))).checks, 'ext:Sigstore'), 'verified', 'the cosign 2 bundle layout');
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

// ---- drand: the round of the public draw (ADR-0095) ---------------------------------------------------------------
// The pairing library is not a dependency of this repository: the signature test runs where NEOLABS_BLS_MODULE names
// it (the workflow of the public repository installs a pinned @noble/curves) and is skipped elsewhere.
const blsModule = process.env.NEOLABS_BLS_MODULE ?? null;
const drand = await import('../drand.mjs');

test('a drand beacon: the randomness must be the SHA-256 of the signature; without a pairing library nothing is called verified', async () => {
  const signature = 'ab'.repeat(48);
  const beacon = { round: 1234, randomness: await sha256(Uint8Array.from({ length: 48 }, () => 0xab)), signature };
  assert.equal(await drand.randomnessMatches(beacon), true);
  const chain = { public_key: 'cd'.repeat(96), schemeID: drand.SCHEME, period: 3, genesis_time: 1692803367 };
  assert.equal((await drand.verifyBeacon(chain, beacon)).status, 'insufficient');
  assert.equal((await drand.verifyBeacon(chain, { ...beacon, randomness: '0'.repeat(64) })).status, 'discrepancy');
  assert.equal((await drand.verifyBeacon({ ...chain, schemeID: 'pedersen-bls-chained' }, beacon)).status, 'insufficient');
  assert.equal((await drand.verifyBeacon(null, beacon)).status, 'insufficient');
  assert.equal((await drand.verifyBeacon(chain, { round: 0, randomness: beacon.randomness, signature })).status, 'discrepancy');
  assert.equal((await drand.verifyBeacon(chain, 'not a beacon')).status, 'discrepancy');
});

test('a drand beacon: the signature verifies under the key of the chain, and under no other key or round', { skip: blsModule === null ? 'NEOLABS_BLS_MODULE is not set' : false }, async () => {
  const { bls12_381: bls } = await import(blsModule);
  const secret = bls.utils.randomPrivateKey();
  const chain = { public_key: Buffer.from(bls.getPublicKeyForShortSignatures(secret)).toString('hex'), schemeID: drand.SCHEME };
  const beacon = await drand.signBeacon(bls, secret, 987654);
  assert.equal((await drand.verifyBeacon(chain, beacon, bls)).status, 'verified');
  assert.equal((await drand.verifyBeacon(chain, { ...beacon, round: 987655 }, bls)).status, 'discrepancy');
  const other = { ...chain, public_key: Buffer.from(bls.getPublicKeyForShortSignatures(bls.utils.randomPrivateKey())).toString('hex') };
  assert.equal((await drand.verifyBeacon(other, beacon, bls)).status, 'discrepancy');
});

test('the draw in a pack: the round the manifest fixed, the sample it gives; another round, a late round or another sample are discrepancies', async () => {
  const signature = '5e'.repeat(48);
  const beacon = { round: 5000, randomness: await sha256(Uint8Array.from({ length: 48 }, () => 0x5e)), signature };
  const fixed = { manifest: { campaign: { lab_run_id: 'fixture', public_sample: { status: 'pending', round: 5000, size: 3, detail: 'Round 5000 of the chain fixed by the protocol.' } } } };
  const proof = (extra = {}) => () => [{ provider: 'drand (League of Entropy)', group: 'sample', kind: 'drand-beacon', status: 'verified', file: 'proofs/drand-round.json', ...extra }];
  const run = async (change, value = beacon) => {
    const p = await pack(change);
    p.files.set('proofs/drand-round.json', enc.encode(JSON.stringify(value)));
    return { p, checks: (await checkPack(reader(p.files))).checks };
  };
  const good = await run({ ...fixed, proofs: proof() });
  const drawn = await drawSample(good.p.manifest.results.tasks, beacon.randomness, 3);
  const check = good.checks.find((c) => c.id === 'ext:drand (League of Entropy)');
  assert.equal(check.status, 'verified');
  assert.equal(check.group, 'sample');
  for (const id of drawn) assert.ok(check.detail.includes(id));
  assert.equal(statusOf((await run({ ...fixed, proofs: proof({ sample: drawn }) })).checks, 'ext:drand (League of Entropy)'), 'verified');
  assert.equal(statusOf((await run({ ...fixed, proofs: proof({ sample: ['t01', 't02', 't03'].filter((id) => !drawn.includes(id)).concat(drawn).slice(0, 3) }) })).checks, 'ext:drand (League of Entropy)'), 'discrepancy');
  assert.equal(statusOf((await run({ ...fixed, proofs: proof() }, { ...beacon, round: 5001 })).checks, 'ext:drand (League of Entropy)'), 'discrepancy');
  assert.equal(statusOf((await run({ ...fixed, proofs: proof() }, { ...beacon, randomness: 'a'.repeat(64) })).checks, 'ext:drand (League of Entropy)'), 'discrepancy');
  // A manifest that fixed no round before the campaign cannot receive a draw afterwards.
  assert.equal(statusOf((await run({ proofs: proof() })).checks, 'ext:drand (League of Entropy)'), 'discrepancy');
});

// ---- Deposit in a Zenodo-compatible repository (ADR-0095): a local stand-in, no network -----------------------------
function repository({ failAt = null, corrupt = null } = {}) {
  const calls = [];
  const md5 = async (bytes) => (await import('node:crypto')).createHash('md5').update(bytes).digest('hex');
  const answer = (status, body) => ({ ok: status < 300, status, json: async () => body });
  const fetcher = async (url, init) => {
    calls.push({ url, method: init.method, auth: init.headers.Authorization, body: init.body });
    const step = init.method === 'POST' && url.endsWith('/deposit/depositions') ? 'create' : init.method === 'PUT' && url.includes('/bucket/') ? 'upload' : init.method === 'PUT' ? 'describe' : 'publish';
    if (failAt === step) return answer(500, { message: `echo ${init.headers.Authorization}` });
    if (step === 'create') return answer(201, { id: 42, links: { bucket: 'https://sandbox.example/api/bucket/b1' } });
    if (step === 'upload') return answer(201, { checksum: `md5:${corrupt !== null && url.endsWith(corrupt) ? '0'.repeat(32) : await md5(init.body)}` });
    if (step === 'describe') return answer(200, { id: 42 });
    return answer(202, { id: 42, doi: '10.5072/zenodo.42', links: { record_html: 'https://sandbox.example/records/42' } });
  };
  return { calls, fetcher };
}

test('a deposit uploads the pack and nothing else, checks every checksum, and returns the DOI it obtained', async () => {
  const { deposit, depositPlan, HOLDER } = await import('../deposit.mjs');
  const p = await pack();
  const repo = repository();
  const record = await deposit({ api: 'https://sandbox.example/api', token: 'fixture-token', read: reader(p.files), repository: 'https://github.com/example/proofs', fetcher: repo.fetcher, now: () => '2026-01-03T00:00:00.000Z' });
  assert.equal(record.doi, '10.5072/zenodo.42');
  assert.equal(record.manifest_sha256, p.digest);
  assert.equal(record.sandbox, true);
  assert.deepEqual(record.files.map((f) => f.name).sort(), ['ledger-7.tsr', 'ledger-entry-7.json', 'manifest.jcs', 'manifest.json', 'report.pdf', 'results.json']);
  assert.ok(repo.calls.every((call) => call.auth === 'Bearer fixture-token'));
  assert.equal(repo.calls.at(-1).url, 'https://sandbox.example/api/deposit/depositions/42/actions/publish');
  const { metadata } = await depositPlan(reader(p.files), { sandbox: true });
  assert.match(metadata.title, /^\[REHEARSAL, not a permanent record\]/);
  assert.ok(metadata.description.includes(p.digest));
  assert.deepEqual(metadata.creators, [{ name: HOLDER }]);
  assert.equal(metadata.license, 'cc-by-4.0');
  assert.doesNotMatch(JSON.stringify(metadata), /certified|independently validated|audited by/i);
  assert.doesNotMatch((await depositPlan(reader(p.files))).metadata.title, /REHEARSAL/);
});

test('a deposit stops before any upload on a pack that differs from its manifest, never publishes a wrong content, and never echoes the token', async () => {
  const { deposit } = await import('../deposit.mjs');
  const p = await pack();
  const base = { api: 'https://sandbox.example/api', token: 'fixture-token', read: reader(p.files) };
  await assert.rejects(deposit({ ...base, token: '', fetcher: repository().fetcher }), /no access token/);
  const altered = new Map(p.files); altered.set('report.pdf', enc.encode('%PDF altered'));
  const untouched = repository();
  await assert.rejects(deposit({ ...base, read: reader(altered), fetcher: untouched.fetcher }), /report\.pdf does not match/);
  assert.equal(untouched.calls.length, 0);
  const wrong = repository({ corrupt: 'results.json' });
  await assert.rejects(deposit({ ...base, fetcher: wrong.fetcher }), /results\.json: the repository holds another content/);
  assert.ok(!wrong.calls.some((call) => call.url.endsWith('/actions/publish')));
  for (const step of ['create', 'upload', 'describe', 'publish']) {
    await assert.rejects(deposit({ ...base, fetcher: repository({ failAt: step }).fetcher }), (error) => /HTTP 500/.test(error.message) && !error.message.includes('fixture-token'));
  }
});
