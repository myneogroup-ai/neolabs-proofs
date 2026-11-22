// publish.mjs - two more places where a pack, or the protocol of a test, can be deposited (ADR-0101):
//   - Hugging Face: the per-task public results of a pack as a dataset repository;
//   - OSF: the protocol of a test in a project, BEFORE the test runs (preregistration).
// Each has a REHEARSAL that leaves nothing behind (a private repository or project, created, read back, compared and
// deleted) and a real deposit that is public and meant to stay: only on the Founder's explicit go. Tokens are read
// by the caller from the environment of the workflow and never written anywhere; an error never echoes a body.
// The files of a pack are checked against its manifest before anything is sent (deposit.mjs `depositPlan`).

import { sha256 } from './jcs.mjs';
import { depositPlan, HOLDER } from './deposit.mjs';

const base64 = (bytes) => Buffer.from(bytes).toString('base64');
/** The files of a pack that go to a dataset repository: its data and manifest, as text. */
export const TEXT_FILE = /\.(json|jcs|md|pem|csv)$/;
const text = (value) => new TextEncoder().encode(value);

function caller(fetcher, token) {
  return async (step, url, init = {}, expect = 'json') => {
    const response = await fetcher(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) } });
    if (!response.ok) {
      // What the service says of its refusal, when it says it in the usual place (JSON:API `errors[].detail`, or
      // `error`): at most 160 characters, never the token. Nothing else of the body is repeated.
      let said = '';
      try { const body = await response.json(); said = String(body?.errors?.[0]?.detail ?? body?.error ?? ''); } catch { said = ''; }
      said = said.replaceAll(token, '[token]').replace(/\s+/g, ' ').slice(0, 160);
      throw new Error(`${step}: the service answered HTTP ${String(response.status)}${said === '' ? '' : ` (${said})`}`);
    }
    if (expect === 'none') return null;
    return expect === 'bytes' ? new Uint8Array(await response.arrayBuffer()) : response.json();
  };
}

/** The dataset card: what the files are, what they are not. No provider, no model, no amount spent. */
export function datasetCard(plan, title, repository) {
  return [
    '---', 'license: cc-by-4.0', 'pretty_name: NEO AI Evaluations - evidence pack', '---', '',
    `# ${title}: evidence pack`, '',
    `Per-task public results of this official test (status, time, cost per answer, reviewers' scores) and the manifest that fingerprints them.`,
    `SHA-256 of the RFC 8785 form of the manifest: \`${plan.manifest_sha256}\`.`, '',
    `Every published figure can be recomputed from \`results.json\` with the published scorer${repository ? ` (${repository})` : ''}.`,
    'The report (PDF) and the time-stamp tokens of the pack are binary files: they are in the public proof repository, not here.',
    'Quality scores are the judgement of AI reviewer models recorded at the time. No external party has reproduced or audited this test.', '',
    `Holder: ${HOLDER}. Licence of the data: CC BY 4.0.`, '',
  ].join('\n');
}

/**
 * Hugging Face. `rehearsal: true` creates a PRIVATE dataset repository, commits the pack, reads every file back,
 * compares its SHA-256 and deletes the repository. Otherwise the repository is public and stays.
 * Returns { service, rehearsal, repository, url, commit, manifest_sha256, files: [{ name, sha256 }], deleted }.
 */
export async function publishToHuggingFace({ token, read, name, title = 'NEOLABS official test', repository = null, rehearsal = true, fetcher = globalThis.fetch, api = 'https://huggingface.co' }) {
  if (typeof token !== 'string' || token === '') throw new Error('no access token: nothing was attempted');
  if (!/^[a-z0-9][a-z0-9-]{2,60}$/.test(name)) throw new Error('the name of the dataset repository is not a simple slug');
  const plan = await depositPlan(read, { repository });
  const call = caller(fetcher, token);
  const who = await call('read the account', `${api}/api/whoami-v2`);
  if (typeof who?.name !== 'string' || who.name === '') throw new Error('read the account: the answer names no account');
  const repo = `${who.name}/${name}`;
  const json = { 'Content-Type': 'application/json' };
  await call('create the dataset repository', `${api}/api/repos/create`, { method: 'POST', headers: json, body: JSON.stringify({ type: 'dataset', name, private: rehearsal }) });
  let record = null;
  try {
    // A dataset repository takes text files in a plain commit; a binary file (the PDF of the report, a time-stamp
    // token) would need its large-file protocol and is not data: those stay in the proof repository and the DOI.
    const files = [...plan.files.filter((file) => TEXT_FILE.test(file.name)), { name: 'README.md', bytes: text(datasetCard(plan, title, repository)) }];
    const lines = [{ key: 'header', value: { summary: `Evidence pack, manifest ${plan.manifest_sha256.slice(0, 12)}`, description: '' } }, ...files.map((file) => ({ key: 'file', value: { path: file.name, encoding: 'base64', content: base64(file.bytes) } }))];
    const commit = await call('commit the pack', `${api}/api/datasets/${repo}/commit/main`, { method: 'POST', headers: { 'Content-Type': 'application/x-ndjson' }, body: lines.map((line) => JSON.stringify(line)).join('\n') });
    const checked = [];
    for (const file of files) {
      const back = await call(`read ${file.name} back`, `${api}/datasets/${repo}/resolve/main/${encodeURIComponent(file.name)}`, {}, 'bytes');
      const [sent, held] = [await sha256(file.bytes), await sha256(back)];
      if (sent !== held) throw new Error(`read ${file.name} back: the repository holds another content than the pack`);
      checked.push({ name: file.name, sha256: held });
    }
    record = { service: 'huggingface', rehearsal, repository: repo, url: `${api}/datasets/${repo}`, commit: commit?.commitOid ?? null, manifest_sha256: plan.manifest_sha256, files: checked, deleted: false };
  } finally {
    // A rehearsal leaves nothing behind, whether it passed or not.
    if (rehearsal) {
      await call('delete the rehearsal repository', `${api}/api/repos/delete`, { method: 'DELETE', headers: json, body: JSON.stringify({ type: 'dataset', name }) }, 'none');
      if (record !== null) record.deleted = true;
    }
  }
  return record;
}

/**
 * OSF. Deposits the protocol of a test in a project. `rehearsal: true`: a PRIVATE project, the file uploaded, its
 * SHA-256 as OSF computed it compared with ours, the project deleted. Otherwise the project is public and stays; the
 * frozen registration itself is made from it by a person in OSF (a registration can never be withdrawn silently).
 * Returns { service, rehearsal, node, url, file, sha256, deleted }.
 */
export async function depositProtocolOnOsf({ token, protocol, filename = 'protocol.md', title, rehearsal = true, fetcher = globalThis.fetch, api = 'https://api.osf.io/v2', files = 'https://files.osf.io/v1' }) {
  if (typeof token !== 'string' || token === '') throw new Error('no access token: nothing was attempted');
  if (!(protocol instanceof Uint8Array) || protocol.length === 0) throw new Error('the protocol is empty');
  if (!/^[A-Za-z0-9._-]{1,80}$/.test(filename)) throw new Error('the file name of the protocol is not a simple name');
  const call = caller(fetcher, token);
  const ours = await sha256(protocol);
  const vnd = { 'Content-Type': 'application/vnd.api+json' };
  const description = `Protocol of an official test of NEO AI Evaluations, deposited before the test runs. SHA-256 of ${filename}: ${ours}. Holder: ${HOLDER}.`;
  const me = await call('read the account', `${api}/users/me/`);
  if (typeof me?.data?.id !== 'string') throw new Error('read the account: the answer names no account');
  const created = await call('create the project', `${api}/nodes/`, { method: 'POST', headers: vnd, body: JSON.stringify({ data: { type: 'nodes', attributes: { title: `${rehearsal ? '[REHEARSAL, to be deleted] ' : ''}${title}`, category: 'project', public: !rehearsal, description } } }) });
  const node = created?.data?.id;
  if (typeof node !== 'string' || !/^[a-z0-9]{4,10}$/.test(node)) throw new Error('create the project: the answer carries no project id');
  let record = null;
  try {
    const uploaded = await call('upload the protocol', `${files}/resources/${node}/providers/osfstorage/?kind=file&name=${encodeURIComponent(filename)}`, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: protocol });
    const held = uploaded?.data?.attributes?.extra?.hashes?.sha256;
    if (held !== ours) throw new Error(`upload the protocol: OSF holds another content than the protocol (${typeof held === 'string' ? 'another SHA-256' : 'no SHA-256 in its answer'})`);
    record = { service: 'osf', rehearsal, node, url: `https://osf.io/${node}/`, file: filename, sha256: held, deleted: false };
  } finally {
    if (rehearsal) {
      await call('delete the rehearsal project', `${api}/nodes/${node}/`, { method: 'DELETE' }, 'none');
      if (record !== null) record.deleted = true;
    }
  }
  return record;
}
