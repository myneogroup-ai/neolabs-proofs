// deposit.mjs - deposits an evidence pack in a Zenodo-compatible repository and returns the record it obtained.
// The same code runs against the Zenodo SANDBOX (a rehearsal: its records are test records, its DOIs resolve
// nowhere and may be wiped) and against Zenodo itself (a PERMANENT public record with a DataCite DOI: only on the
// Founder's explicit go, ADR-0092 and ADR-0095). The access token is read by the caller from the environment of the
// workflow and never written anywhere. What is uploaded is the pack only: the manifest, its RFC 8785 form and the
// files the manifest names. A file whose SHA-256 differs from the manifest stops the deposit before any upload.

import { canonicalize, sha256 } from './jcs.mjs';
import { MANIFEST_SCHEMA, manifestDigest } from './pack.mjs';

export const HOLDER = 'NEO TECH LABS TECHNOLOGY L.L.C.';
const md5Of = async (bytes) => { const { createHash } = await import('node:crypto'); return createHash('md5').update(bytes).digest('hex'); };

/** What a deposit of this pack would upload and declare; throws when the pack does not match its manifest. */
export async function depositPlan(read, { repository = null, sandbox = false } = {}) {
  const raw = await read('manifest.json');
  let manifest = null;
  try { manifest = JSON.parse(new TextDecoder().decode(raw)); } catch { manifest = null; }
  if (manifest === null || manifest.schema !== MANIFEST_SCHEMA) throw new Error('manifest.json is missing or is not a NEOLABS manifest');
  const digest = await manifestDigest(manifest);
  const files = [{ name: 'manifest.json', bytes: raw }, { name: 'manifest.jcs', bytes: new TextEncoder().encode(canonicalize(manifest)) }];
  for (const file of manifest.files) {
    const bytes = await read(file.path);
    if (bytes === null) throw new Error(`${file.path} is named by the manifest and is not in the pack`);
    if ((await sha256(bytes)) !== file.sha256) throw new Error(`${file.path} does not match the SHA-256 the manifest records`);
    if (file.path.includes('/')) throw new Error(`${file.path}: a deposited file has a flat name`);
    files.push({ name: file.path, bytes });
  }
  const title = String(manifest.test?.title ?? 'NEOLABS official test');
  const links = [manifest.test?.report ? `Report: ${String(manifest.test.report)}.` : '', repository ? `Public proof repository: ${repository}.` : ''].filter(Boolean).join(' ');
  return {
    manifest_sha256: digest,
    files,
    metadata: {
      title: `${sandbox ? '[REHEARSAL, not a permanent record] ' : ''}${title}: evidence pack, manifest version ${String(manifest.manifest_version ?? 1)}`,
      upload_type: 'dataset',
      description: `Evidence pack of ${title}: the per-task public results (status, time, cost per answer, reviewers' scores), the manifest that fingerprints them and the proofs it names. SHA-256 of the RFC 8785 form of the manifest: ${digest}. Anyone can recompute every published figure from these files with the published scorer. ${links} Quality scores are the judgement of AI reviewer models recorded at the time; no external party has reproduced or audited this test.`.trim(),
      creators: [{ name: HOLDER }],
      license: 'cc-by-4.0',
      access_right: 'open',
      version: String(manifest.manifest_version ?? 1),
      publication_date: String(manifest.generated_at ?? '').slice(0, 10),
      keywords: ['evidence pack', 'evaluation', 'RFC 8785', 'reproducibility'],
      ...(repository ? { related_identifiers: [{ identifier: repository, relation: 'isSupplementTo', scheme: 'url' }] } : {}),
    },
  };
}

/**
 * Creates the deposition, uploads the files, checks the checksum the repository computed for each, and publishes.
 * `api` is the base of the REST API (https://sandbox.zenodo.org/api or https://zenodo.org/api).
 * Returns { api, id, doi, url, manifest_sha256, published_at, files: [{ name, md5 }] }.
 */
export async function deposit({ api, token, read, repository = null, fetcher = globalThis.fetch, now = () => new Date().toISOString() }) {
  if (typeof token !== 'string' || token === '') throw new Error('no access token: the deposit was not attempted');
  const sandbox = /sandbox/.test(new URL(api).hostname);
  const plan = await depositPlan(read, { repository, sandbox });
  const auth = { Authorization: `Bearer ${token}` };
  const call = async (step, url, init) => {
    const response = await fetcher(url, { ...init, headers: { ...auth, ...(init.headers ?? {}) } });
    // The body of an error is not echoed whole: a repository may repeat request details in it.
    if (!response.ok) throw new Error(`${step}: the repository answered HTTP ${String(response.status)}`);
    return response.json();
  };
  const json = { 'Content-Type': 'application/json' };
  const created = await call('create the deposition', `${api}/deposit/depositions`, { method: 'POST', headers: json, body: '{}' });
  const bucket = created?.links?.bucket;
  if (typeof bucket !== 'string' || created?.id === undefined) throw new Error('create the deposition: the answer carries no bucket');
  const uploaded = [];
  for (const file of plan.files) {
    const put = await call(`upload ${file.name}`, `${bucket}/${encodeURIComponent(file.name)}`, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: file.bytes });
    const md5 = await md5Of(file.bytes);
    if (String(put?.checksum ?? '') !== `md5:${md5}`) throw new Error(`upload ${file.name}: the repository holds another content than the pack (checksum ${String(put?.checksum ?? 'absent')})`);
    uploaded.push({ name: file.name, md5 });
  }
  await call('describe the deposition', `${api}/deposit/depositions/${String(created.id)}`, { method: 'PUT', headers: json, body: JSON.stringify({ metadata: plan.metadata }) });
  const published = await call('publish the deposition', `${api}/deposit/depositions/${String(created.id)}/actions/publish`, { method: 'POST', headers: json, body: '{}' });
  if (typeof published?.doi !== 'string' || published.doi === '') throw new Error('publish the deposition: the answer carries no DOI');
  return { api, sandbox, id: published.id ?? created.id, doi: published.doi, url: published?.links?.record_html ?? published?.links?.html ?? null, manifest_sha256: plan.manifest_sha256, published_at: now(), files: uploaded };
}
