// pack.mjs - the evidence pack of an official test: its manifest (RFC 8785, SHA-256) and the checks anyone can run
// on it. Runs in Node and in a browser; `read(path)` returns the bytes of a file of the pack, or `null`.
//
//   manifest.json            what was tested, the files with their SHA-256, the published figures and their rules
//   publication-index.json   what was added AFTER the manifest was sealed (external proofs, links, their states);
//                            it names the manifest by its SHA-256 and never changes it
//
// Statuses: verified, pending, discrepancy, insufficient (the data needed is not public or not recorded),
// not_applicable. A check never reports more than it did: a signature this code does not verify is `insufficient`
// with the command that verifies it.

import { bytesOf, canonicalize, hex, sha256 } from './jcs.mjs';
import { randomnessMatches, readBeacon } from './drand.mjs';
import { merkleRoot } from './merkle.mjs';
import { drawSample } from './sample.mjs';
import { differences, publishedOf, score } from './score.mjs';
import { knownAnswers, thresholdOutcome } from './known.mjs';

export const MANIFEST_SCHEMA = 'neolabs.manifest/1';
export const INDEX_SCHEMA = 'neolabs.publication-index/1';
export const RESULTS_SCHEMA = 'neolabs.public-results/1';
export const STATUSES = ['verified', 'pending', 'discrepancy', 'insufficient', 'not_applicable'];

const decoder = new TextDecoder();
const text = (bytes) => decoder.decode(bytes);

export const manifestDigest = (manifest) => sha256(canonicalize(manifest));

/** The ledger rule (origin-server/src/ledger.ts): SHA-256( prev_hash || canonical(entry without seq and hashes) ). */
export async function ledgerHash(entry) {
  const sorted = (v) => (v === null || typeof v !== 'object' ? (JSON.stringify(v) ?? 'null') : Array.isArray(v) ? `[${v.map(sorted).join(',')}]` : `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${sorted(v[k] === undefined ? null : v[k])}`).join(',')}}`);
  const body = sorted({ id: entry.id, at: new Date(entry.at).toISOString(), kind: entry.kind, account_id: entry.account_id, actor_id: entry.actor_id, run_id: entry.run_id, conversation_id: entry.conversation_id, message_id: entry.message_id, payload: entry.payload });
  return sha256(`${entry.prev_hash}${body}`);
}

function contains(haystack, needle) {
  outer: for (let i = 0; i + needle.length <= haystack.length; i += 1) {
    for (let j = 0; j < needle.length; j += 1) if (haystack[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
}

/** Builds the manifest of a test. `files` is [{ path, role, bytes }]; `results` the public results document. */
const KNOWN_RULES = [
  'A successful task is an answer whose final answer equals the expected one (automatic comparison, no reviewer). A failed answer is not a successful task.',
  'The cost of a system is the sum of the cost of all its answers, the failed ones included. Cost per successful task = that sum divided by the number of successful tasks.',
  'Time: the median total time of the completed answers, in milliseconds.',
  'The thresholds were fixed by the protocol before the run; the outcome is "met" only if every condition holds.',
];

export async function buildManifest({ test, campaign, versions, files, results, ledger, timestamps, costs, limits, generated_at, previous_manifest_sha256 = null, manifest_version = 1, corrections = undefined }) {
  const recomputed = score(results);
  const inventory = [];
  for (const file of [...files].sort((a, b) => (a.path < b.path ? -1 : 1))) inventory.push({ path: file.path, role: file.role, bytes: file.bytes.length, sha256: await sha256(file.bytes) });
  return {
    schema: MANIFEST_SCHEMA,
    manifest_version,
    previous_manifest_sha256,
    // What changed since the previous manifest, when this one corrects it (absent on a first version).
    ...(corrections === undefined ? {} : { corrections }),
    generated_at,
    test,
    campaign,
    versions,
    files: inventory,
    results: {
      file: 'results.json',
      rows: results.rows.length,
      by_status: recomputed.by_status,
      tasks: [...new Set(results.rows.map((row) => row.task_id))].sort(),
      systems: [...new Set(results.rows.map((row) => row.system))].sort(),
      exclusions: results.exclusions ?? [],
      merkle: { construction: 'RFC 6962 (SHA-256); leaf = RFC 8785 form of the row', leaves: results.rows.length, root: await merkleRoot(results.rows) },
    },
    metrics: {
      rules: [
        'Judged quality of an answer: the mean of its reviewers\' scores (1 to 10). Judged quality of a system: the mean over its completed answers that carry a score; n is that count.',
        'Time: the median total time of the completed answers, in milliseconds. Cost: the mean cost of the completed answers, in millionths of a US dollar, as computed by the platform from the token counts reported by the providers and the price table in force.',
        'Intervals: 95% percentile bootstrap, 2,000 resamples, seeded with the seed of the campaign.',
        'Comparisons: one LILI profile against one reference on the tasks both completed; paired sign-flip test, 20,000 flips, seeded; significant at 0.05 after Holm\'s correction over all comparisons; at least 10 pairs.',
        'Figures are stored at full precision; a page or a report rounds for display only.',
      ],
      units: { quality: 'points out of 10', total_ms: 'milliseconds', cost_micro_usd: 'millionths of a US dollar' },
      published: publishedOf(recomputed),
      // A test on tasks with one known answer (Official Test No. 3 onwards): exact answers, cost per successful task,
      // and the outcome of the thresholds its protocol fixed before the run (`campaign.thresholds`).
      ...(campaign?.thresholds === undefined ? {} : (() => { const measures = knownAnswers(results); return { known_answers: { rules: KNOWN_RULES, published: measures, thresholds: campaign.thresholds, outcome: thresholdOutcome(measures, campaign.thresholds) } }; })()),
    },
    costs,
    proof_ledger: ledger,
    timestamps,
    limits,
  };
}

/** Runs every check of a pack. Returns { manifest_sha256, checks: [{ id, group, status, title, detail }] }. */
export async function checkPack(read) {
  const checks = [];
  const add = (id, group, status, title, detail = '') => checks.push({ id, group, status, title, detail });
  const json = async (path) => { const bytes = await read(path); if (bytes === null) return null; try { return JSON.parse(text(bytes)); } catch { return undefined; } };

  const manifest = await json('manifest.json');
  if (manifest === null || manifest === undefined || manifest.schema !== MANIFEST_SCHEMA) {
    add('manifest', 'integrity', 'discrepancy', 'Manifest', manifest === null ? 'manifest.json is missing.' : 'manifest.json is not a NEOLABS manifest.');
    return { manifest_sha256: null, checks };
  }
  const digest = await manifestDigest(manifest);
  const index = await json('publication-index.json');

  // Integrity: every file of the inventory.
  let bad = 0;
  for (const file of manifest.files) {
    const bytes = await read(file.path);
    if (bytes === null) { bad += 1; add(`file:${file.path}`, 'integrity', 'discrepancy', file.path, 'The file is missing.'); continue; }
    const got = await sha256(bytes);
    if (got !== file.sha256) { bad += 1; add(`file:${file.path}`, 'integrity', 'discrepancy', file.path, `SHA-256 is ${got}; the manifest records ${file.sha256}.`); }
  }
  if (bad === 0) add('files', 'integrity', 'verified', 'Files', `${String(manifest.files.length)} files match the SHA-256 recorded in the manifest.`);

  if (index === null) add('index', 'integrity', 'insufficient', 'Publication index', 'publication-index.json is not in this folder: external proofs cannot be listed.');
  else if (index === undefined || index.schema !== INDEX_SCHEMA) add('index', 'integrity', 'discrepancy', 'Publication index', 'publication-index.json is not a NEOLABS publication index.');
  else if (index.manifest_sha256 !== digest) add('index', 'integrity', 'discrepancy', 'Publication index', `The index names manifest ${String(index.manifest_sha256)}; this manifest is ${digest}.`);
  else add('index', 'integrity', 'verified', 'Manifest fingerprint', `SHA-256 of the RFC 8785 form: ${digest}. The publication index names the same manifest.`);

  // Results: the rows, the expected scenarios, the Merkle root, the figures.
  const results = await json(manifest.results.file);
  if (results === null || results === undefined || results.schema !== RESULTS_SCHEMA) {
    add('scores', 'scores', 'insufficient', 'Scores', 'The per-task results are not in this folder: the published figures cannot be recomputed.');
  } else {
    const have = new Set(results.rows.map((row) => `${row.system}|${row.task_id}`));
    const excluded = new Set((manifest.results.exclusions ?? []).map((e) => `${e.system}|${e.task_id}`));
    const missing = manifest.results.systems.flatMap((system) => manifest.results.tasks.map((task) => `${system}|${task}`)).filter((key) => !have.has(key) && !excluded.has(key));
    if (missing.length > 0) add('rows', 'scores', 'discrepancy', 'Expected scenarios', `${String(missing.length)} expected results are absent with no recorded reason, for example ${missing[0]}.`);
    else add('rows', 'scores', 'verified', 'Expected scenarios', `${String(manifest.results.tasks.length)} tasks x ${String(manifest.results.systems.length)} systems: every result is present${excluded.size > 0 ? ` or excluded with its reason (${String(excluded.size)})` : ''}.`);
    const root = await merkleRoot(results.rows);
    add('merkle', 'scores', root === manifest.results.merkle.root ? 'verified' : 'discrepancy', 'Merkle root of the results', root === manifest.results.merkle.root ? `Root ${root} over ${String(results.rows.length)} rows.` : `Recomputed ${root}; the manifest records ${manifest.results.merkle.root}.`);
    const diffs = differences(manifest.metrics.published, publishedOf(score(results)));
    if (diffs.length === 0 && (manifest.metrics.published?.judging?.scores ?? 0) === 0) add('scores', 'scores', 'verified', 'Statistics', 'Every published statistic (time, cost, intervals, comparisons) is recomputed identically from the per-task results. No reviewer scored an answer in this test.');
    else if (diffs.length === 0) add('scores', 'scores', 'verified', 'Scores', 'Every published figure (quality, time, cost, intervals, comparisons) is recomputed identically from the per-task results. The reviewers\' scores themselves are historical records: this check verifies their aggregation, not the reviewers\' judgement.');
    else add('scores', 'scores', 'discrepancy', 'Scores', `${String(diffs.length)} published figures differ from the recomputation, for example ${diffs[0].path}: published ${String(diffs[0].published)}, recomputed ${String(diffs[0].recomputed)}.`);
  }

  const known = manifest.metrics?.known_answers;
  if (known !== undefined && results !== null && results !== undefined && results.schema === RESULTS_SCHEMA) {
    const measures = knownAnswers(results);
    const diffs = differences({ published: known.published, outcome: known.outcome }, { published: measures, outcome: thresholdOutcome(measures, known.thresholds) });
    if (diffs.length === 0) add('known', 'scores', 'verified', 'Exact answers and thresholds', `Exact answers, cost per successful task and the outcome of the thresholds ("${known.outcome.result}") are recomputed identically from the per-task results. Whether an answer is exact is the platform's recorded comparison: this check verifies the figures drawn from it, not the comparison.`);
    else add('known', 'scores', 'discrepancy', 'Exact answers and thresholds', `${String(diffs.length)} published figures differ from the recomputation, for example ${diffs[0].path}: published ${String(diffs[0].published)}, recomputed ${String(diffs[0].recomputed)}.`);
  }

  // Provenance: the Proof Ledger entry and the time-stamps the manifest names.
  const ledger = manifest.proof_ledger;
  if (ledger === null || ledger === undefined) add('ledger', 'provenance', 'not_applicable', 'Proof Ledger', 'This test has no Proof Ledger entry.');
  else {
    const entry = await json(ledger.file);
    if (entry === null || entry === undefined) add('ledger', 'provenance', 'insufficient', 'Proof Ledger', 'The ledger entry is not in this folder.');
    else {
      const hash = await ledgerHash(entry);
      const ok = hash === entry.hash && hash === ledger.hash;
      add('ledger', 'provenance', ok ? 'verified' : 'discrepancy', `Proof Ledger entry no. ${String(ledger.entry)}`, ok ? `The entry recomputes to its recorded hash ${hash}.` : `Recomputed ${hash}; recorded ${String(entry.hash)}; manifest ${String(ledger.hash)}.`);
      add('ledger-digest', 'provenance', 'insufficient', 'Results digest of the ledger', 'The digest sealed in the ledger covers the full answers and judgements, which are not public. It is recomputed inside NEO AI (Global Super Admin); the public rows are bound by the Merkle root above.');
    }
  }
  for (const stamp of manifest.timestamps ?? []) {
    const token = await read(stamp.file);
    if (token === null) { add(`ts:${stamp.file}`, 'date', 'insufficient', `${stamp.authority} time-stamp`, 'The token is not in this folder.'); continue; }
    const imprint = contains(token, hexBytes(stamp.imprint_sha256));
    add(`ts:${stamp.file}`, 'date', imprint ? 'verified' : 'discrepancy', `${stamp.authority} time-stamp (${stamp.standard})`, imprint ? `The token carries the fingerprint ${stamp.imprint_sha256} (${stamp.covers}); declared time ${stamp.time}.` : 'The token does not carry the fingerprint the manifest names.');
    add(`ts-sig:${stamp.file}`, 'date', 'insufficient', `${stamp.authority} signature`, `Not checked by this page. Run: ${stamp.verify_command}`);
  }

  // Costs.
  const costs = manifest.costs ?? {};
  add('cost-computed', 'costs', 'verified', 'Costs computed by the platform', `${String(costs.computed?.scope ?? 'Inference cost per answer')}: part of the recomputed figures above.`);
  add('cost-invoices', 'costs', costs.reconciled === null || costs.reconciled === undefined ? 'insufficient' : costs.reconciled.status, 'Costs reconciled with provider invoices', costs.reconciled?.detail ?? costs.reconciliation_limit ?? 'No reconciliation is recorded.');
  for (const item of costs.out_of_scope ?? []) add(`cost-out:${item}`, 'costs', 'not_applicable', 'Out of scope', item);

  // What the manifest declares about protocol and sample.
  const protocol = manifest.campaign?.preregistration;
  add('protocol', 'protocol', protocol?.status ?? 'not_applicable', 'Preregistered protocol', protocol?.detail ?? 'This campaign was not preregistered.');
  const sample = manifest.campaign?.public_sample;
  add('sample', 'sample', sample?.status ?? 'not_applicable', 'Public random sample', sample?.detail ?? 'No public draw was defined for this campaign.');

  // External proofs recorded after the manifest was sealed: shown in the state the index records.
  if (index !== null && index !== undefined && index.manifest_sha256 === digest) {
    for (const proof of index.proofs ?? []) {
      let status = STATUSES.includes(proof.status) ? proof.status : 'insufficient';
      let detail = proof.detail ?? '';
      if (proof.file !== undefined && proof.file !== null) {
        const bytes = await read(proof.file);
        if (bytes === null) { status = status === 'verified' ? 'discrepancy' : status; detail = `${detail} The proof file ${proof.file} is not in this folder.`.trim(); }
        else if (proof.sha256 !== undefined && (await sha256(bytes)) !== proof.sha256) { status = 'discrepancy'; detail = `The proof file ${proof.file} does not match the SHA-256 the index records.`; }
        else if (proof.must_contain_manifest_digest === true && !contains(bytes, hexBytes(digest))) { status = 'discrepancy'; detail = `The proof file ${proof.file} does not carry the fingerprint of this manifest.`; }
        else if (proof.kind === 'sigstore-bundle') {
          // A Sigstore bundle of `cosign sign-blob` over the RFC 8785 bytes: its message digest is the manifest's.
          let bundle = null;
          try { bundle = JSON.parse(text(bytes)); } catch { bundle = null; }
          const want = btoa(String.fromCharCode(...hexBytes(digest)));
          // The digest is carried either by the message signature (base64) or by the Rekor entry of the bundle
          // (a hashedrekord body, base64 JSON naming the SHA-256 in hexadecimal; `rekorBundle.Payload.body` in the cosign 2
          // layout, `verificationMaterial.tlogEntries` in the newer one), depending on the bundle version.
          const bodies = [...(bundle?.verificationMaterial?.tlogEntries ?? []), { canonicalizedBody: bundle?.rekorBundle?.Payload?.body }].map((entry) => { try { return atob(entry.canonicalizedBody ?? ''); } catch { return ''; } });
          const b64 = bundle?.messageSignature?.messageDigest?.digest === want || bodies.some((body) => body.includes(digest)) ? want : null;
          if (b64 !== want) { status = 'discrepancy'; detail = `The Sigstore bundle ${proof.file} signs another content than this manifest.`; }
          else detail = `${detail} The bundle signs the fingerprint of this manifest. The signer identity and the Rekor inclusion are verified by the workflow; to repeat it: ${proof.verify_command ?? 'cosign verify-blob'}`.trim();
        }
        else if (proof.kind === 'drand-beacon') {
          // The round of the public draw, recorded after the manifest was sealed. Checked here: the round is the one
          // the manifest fixed in advance, the randomness is the SHA-256 of the signature, and the sample is the one
          // this randomness draws. The League of Entropy's signature itself is checked by the workflow (pairing).
          let value = null;
          try { value = JSON.parse(text(bytes)); } catch { value = null; }
          const { beacon, reason } = readBeacon(value);
          const declared = manifest.campaign?.public_sample ?? {};
          if (beacon === null) { status = 'discrepancy'; detail = reason; }
          else if (!Number.isSafeInteger(declared.round) || !Number.isSafeInteger(declared.size)) { status = 'discrepancy'; detail = 'The manifest fixed no round and no sample size before the campaign: a draw cannot be attached to it afterwards.'; }
          else if (beacon.round !== declared.round) { status = 'discrepancy'; detail = `The beacon is round ${String(beacon.round)}; the manifest fixed round ${String(declared.round)}.`; }
          else if (!(await randomnessMatches(beacon))) { status = 'discrepancy'; detail = `The randomness of round ${String(beacon.round)} is not the SHA-256 of its signature.`; }
          else {
            const drawn = await drawSample(manifest.results?.tasks ?? [], beacon.randomness, declared.size);
            const recorded = Array.isArray(proof.sample) ? proof.sample : null;
            if (recorded !== null && JSON.stringify(recorded) !== JSON.stringify(drawn)) { status = 'discrepancy'; detail = `The index records the sample ${recorded.join(', ')}; round ${String(beacon.round)} draws ${drawn.join(', ')}.`; }
            else detail = `Round ${String(beacon.round)}, fixed by the manifest before the draw, gives the sample of ${String(declared.size)}: ${drawn.join(', ')}. The randomness is the SHA-256 of the signature. The signature of the League of Entropy is verified by the workflow; to repeat it: ${proof.verify_command ?? 'node verify/cli.mjs drand <beacon.json> <chain.json>'}`;
          }
        }
        else if (proof.must_name_manifest_digest === true && !text(bytes).includes(digest)) { status = 'discrepancy'; detail = `The record ${proof.file} does not name the fingerprint of this manifest.`; }
        else if (proof.doi !== undefined) {
          let record = null;
          try { record = JSON.parse(text(bytes)); } catch { record = null; }
          const found = String(record?.data?.id ?? record?.doi ?? '').toLowerCase();
          if (found !== String(proof.doi).toLowerCase()) { status = 'discrepancy'; detail = `The registry record is for DOI ${found === '' ? '(none)' : found}; the index names ${String(proof.doi)}.`; }
        }
      }
      add(`ext:${proof.provider}`, proof.group ?? 'date', status, proof.provider, [detail, proof.url ? `Link: ${proof.url}` : '', proof.checked_at ? `Last check: ${proof.checked_at}` : ''].filter(Boolean).join(' '));
      if (proof.kind === 'drand-beacon') checks[checks.length - 1].drand = true;
    }
  }
  // The manifest is sealed before the round of its public draw exists, so it can only say "pending". Once the
  // publication index holds the round, and the check of that round is verified, the draw is done: the check of the
  // sample says so. A draw in discrepancy never becomes verified here.
  const draw = checks.find((check) => check.drand === true);
  const pendingSample = checks.find((check) => check.id === 'sample' && check.status === 'pending');
  if (draw !== undefined && draw.status === 'verified' && pendingSample !== undefined) {
    pendingSample.status = 'verified';
    pendingSample.detail = `The round the manifest fixed before the run has been published and checked: the sample is drawn. ${draw.detail}`;
  }
  for (const check of checks) delete check.drand;
  return { manifest_sha256: digest, manifest, checks };
}

function hexBytes(value) {
  const out = new Uint8Array(value.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** The overall state of a set of checks, for one line of summary. */
export function summary(checks) {
  const count = (status) => checks.filter((check) => check.status === status).length;
  return { verified: count('verified'), pending: count('pending'), discrepancy: count('discrepancy'), insufficient: count('insufficient'), not_applicable: count('not_applicable'), ok: count('discrepancy') === 0 };
}

/** Whether a provider still has to be published for this manifest: never twice for the same manifest (no second DOI,
 *  no second release), and a proof that is pending is followed, not created again. */
export function publicationPlan(index, provider, manifest_sha256) {
  if (index === null || index === undefined || index.manifest_sha256 !== manifest_sha256) return 'create';
  const proof = (index.proofs ?? []).find((entry) => entry.provider === provider);
  if (proof === undefined) return 'create';
  if (proof.status === 'verified') return 'skip';
  return proof.url || proof.file || proof.external_id ? 'follow' : 'create';
}

/** The index with one proof added or replaced; the manifest it names never changes. */
export function withProof(index, manifest_sha256, proof, now) {
  const base = index !== null && index !== undefined && index.manifest_sha256 === manifest_sha256 ? index : { schema: INDEX_SCHEMA, manifest_sha256, proofs: [] };
  return { ...base, updated_at: now, proofs: [...(base.proofs ?? []).filter((entry) => entry.provider !== proof.provider), proof].sort((a, b) => (a.provider < b.provider ? -1 : 1)) };
}

export { bytesOf, hex };
