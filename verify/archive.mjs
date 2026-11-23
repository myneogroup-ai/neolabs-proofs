// archive.mjs - two more public destinations for each edition (Founder mission of 23 November 2026):
//   - Internet Archive: one public item per edition (the report PDF, the manifest and the per-task results);
//   - Kaggle: the folder of a dataset (per-task results as JSON and CSV, data dictionary, method, licence, PDF).
// Nothing here calls a model. The files of a pack are checked against its manifest before anything is sent
// (deposit.mjs `depositPlan`). Keys are read by the caller from the environment of the workflow and never written
// anywhere; an error never echoes a body or a key.
//
// Internet Archive has no sandbox. A REHEARSAL goes to its `test_collection`, whose items the Archive removes by
// itself after about thirty days; a real item goes to the community collection and is meant to stay.

import { sha256 } from './jcs.mjs';
import { depositPlan, HOLDER } from './deposit.mjs';

const text = (value) => new TextEncoder().encode(value);
const LICENCE = 'https://creativecommons.org/licenses/by/4.0/';
const ascii = (value) => String(value).replace(/[^\x20-\x7E]/g, '-');

/** The files an edition publishes outside the proof repository: manifest, canonical form, results, and the PDF. */
export async function editionFiles(read, pdf = null) {
  const plan = await depositPlan(read);
  const manifest = JSON.parse(new TextDecoder().decode(plan.files.find((file) => file.name === 'manifest.json').bytes));
  const resultsName = String(manifest.results?.file ?? 'results.json');
  const files = plan.files.filter((file) => ['manifest.json', 'manifest.jcs', resultsName].includes(file.name));
  if (!files.some((file) => file.name === resultsName)) throw new Error(`${resultsName} is named by the manifest and is not in the pack`);
  if (pdf !== null) files.push({ name: pdf.name, bytes: pdf.bytes });
  return { plan, manifest, resultsName, files };
}

/** Metadata of the Internet Archive item, as request headers. ASCII only: the Archive reads headers as bytes. */
export function archiveMetadata({ manifest, digest, rehearsal, doi = null, report = null, repository = null }) {
  const title = String(manifest.test?.title ?? 'Official test').replace(/^NEOLABS /, 'NEO AI Evaluations - ');
  const number = manifest.test?.number;
  const description = [
    `${title}: the public report, the manifest and the per-task public results of this edition.`,
    `SHA-256 of the RFC 8785 form of the manifest: ${digest}.`,
    doi ? `DOI of the archived release: https://doi.org/${doi}.` : '',
    report ? `Official page: ${report}.` : '',
    repository ? `Public proof repository and verifier: ${repository}.` : '',
    `Holder: ${HOLDER}. Licence of the data: CC BY 4.0.`,
  ].filter(Boolean).join(' ');
  const meta = {
    mediatype: 'texts',
    collection: rehearsal ? 'test_collection' : 'opensource',
    title: `${rehearsal ? '[REHEARSAL, removed by the Archive] ' : ''}${title}${number ? ` (Official Test No. ${String(number)})` : ''}`,
    creator: HOLDER,
    date: String(manifest.campaign?.declared_finished_at ?? manifest.generated_at ?? '').slice(0, 10),
    description,
    licenseurl: LICENCE,
    language: 'eng',
    subject: 'NEO AI Evaluations; LILI; evaluation; evidence pack',
  };
  if (doi) meta['external-identifier'] = `doi:${doi}`;
  if (report) meta.source = report;
  return Object.fromEntries(Object.entries(meta).filter(([, value]) => value !== '').map(([key, value]) => [`x-archive-meta-${key}`, ascii(value)]));
}

/**
 * Internet Archive. Creates (or completes) the item `identifier`, then reads every file back from the public
 * download address and compares its SHA-256 with the file sent. The Archive ingests asynchronously: a file not yet
 * served after `attempts` tries makes the record `pending` (the caller follows it later; nothing is sent twice,
 * because a file already served with the right SHA-256 is never uploaded again).
 * Returns { service, rehearsal, identifier, url, status, manifest_sha256, files: [{ name, sha256, url, status }] }.
 */
export async function publishToInternetArchive({ accessKey, secretKey, read, identifier, pdf = null, doi = null, report = null, repository = null, rehearsal = true,
  fetcher = globalThis.fetch, api = 'https://s3.us.archive.org', download = 'https://archive.org/download', attempts = 20, wait = (ms) => new Promise((done) => setTimeout(done, ms)), now = () => new Date().toISOString() }) {
  if (typeof accessKey !== 'string' || accessKey === '' || typeof secretKey !== 'string' || secretKey === '') throw new Error('no access keys: nothing was attempted');
  if (!/^[a-z0-9][a-z0-9-]{4,79}$/.test(identifier)) throw new Error('the identifier of the item is not a simple slug');
  const { plan, manifest, files } = await editionFiles(read, pdf);
  const hide = (value) => String(value).replaceAll(secretKey, '[key]').replaceAll(accessKey, '[key]');
  const served = async (file) => {
    try {
      const response = await fetcher(`${download}/${identifier}/${encodeURIComponent(file.name)}`, { redirect: 'follow' });
      if (!response.ok) return null;
      return sha256(new Uint8Array(await response.arrayBuffer()));
    } catch { return null; }
  };
  const meta = archiveMetadata({ manifest, digest: plan.manifest_sha256, rehearsal, doi, report, repository });
  const checked = [];
  for (const file of files) {
    const sent = await sha256(file.bytes);
    let held = await served(file);
    if (held !== null && held !== sent) throw new Error(`${file.name}: the item ${identifier} already serves another content under this name`);
    if (held === null) {
      const response = await fetcher(`${api}/${identifier}/${encodeURIComponent(file.name)}`, {
        method: 'PUT', body: file.bytes,
        headers: { authorization: `LOW ${accessKey}:${secretKey}`, 'x-archive-auto-make-bucket': '1', 'x-archive-queue-derive': '0', 'x-archive-keep-old-version': '0', 'Content-Type': 'application/octet-stream', ...meta },
      });
      if (!response.ok) throw new Error(hide(`send ${file.name}: the Archive answered HTTP ${String(response.status)}`));
      for (let attempt = 0; attempt < attempts && held === null; attempt += 1) { await wait(30000); held = await served(file); }
      if (held !== null && held !== sent) throw new Error(`read ${file.name} back: the Archive serves another content than the file sent`);
    }
    checked.push({ name: file.name, sha256: sent, url: `${download}/${identifier}/${encodeURIComponent(file.name)}`, status: held === null ? 'pending' : 'verified' });
  }
  return {
    service: 'internet-archive', rehearsal, identifier, url: `https://archive.org/details/${identifier}`,
    status: checked.every((file) => file.status === 'verified') ? 'verified' : 'pending',
    manifest_sha256: plan.manifest_sha256, doi, files: checked, checked_at: now(),
  };
}

const CSV_COLUMNS = ['test', 'task_id', 'class', 'language', 'system', 'status', 'exact_match', 'reviewers_mean_score', 'reviewers', 'total_ms', 'first_token_ms', 'cost_usd'];
const cell = (value) => (value === null || value === undefined ? '' : /[",\n]/.test(String(value)) ? `"${String(value).replaceAll('"', '""')}"` : String(value));

/** The per-task public results as CSV: one row per task and system, under the public name of each system. */
export function resultsCsv(manifest, results) {
  const names = manifest.versions?.systems ?? {};
  const rows = results.rows.map((row) => {
    const scores = (row.scores ?? []).map((score) => (typeof score === 'number' ? score : score?.score)).filter((score) => typeof score === 'number');
    return [manifest.test?.id, row.task_id, row.class, row.language, names[row.system] ?? row.system, row.status, row.exact_match,
      scores.length === 0 ? null : scores.reduce((sum, value) => sum + value, 0) / scores.length, scores.length,
      row.total_ms, row.first_token_ms, typeof row.cost_micro_usd === 'number' ? row.cost_micro_usd / 1e6 : null];
  });
  return `${[CSV_COLUMNS, ...rows].map((line) => line.map(cell).join(',')).join('\n')}\n`;
}

/** The data dictionary and the method of calculation, as the README of the dataset. */
export function dataDictionary({ manifest, digest, doi = null, report = null, repository = null, pdfName = null }) {
  const title = String(manifest.test?.title ?? 'Official test').replace(/^NEOLABS /, 'NEO AI Evaluations - ');
  const rules = [...(manifest.metrics?.known_answers?.rules ?? []), ...(manifest.metrics?.known_answers ? [] : manifest.metrics?.rules ?? [])];
  return [
    `# ${title}: per-task public results`, '',
    `Edition fingerprint (SHA-256 of the RFC 8785 form of the manifest): \`${digest}\`.`,
    doi ? `DOI of the archived release: https://doi.org/${doi}` : '',
    report ? `Official page: ${report}` : '',
    repository ? `Public proof repository and verifier: ${repository}` : '', '',
    '## Files', '',
    '- `results.csv`: one row per task and system (the table below).',
    '- `results.json`: the same rows, the file the manifest fingerprints.',
    '- `manifest.json`: what was measured, the rules, the published figures and the SHA-256 of every file of the pack.',
    pdfName ? `- \`${pdfName}\`: the public report of this edition.` : '', '',
    '## Columns of results.csv', '',
    '| Column | Meaning |', '|---|---|',
    '| test | identifier of the official test |',
    '| task_id | identifier of the task; the same task is given to every system |',
    '| class | class of the task (for example reasoning, data, code) |',
    '| language | language of the task |',
    '| system | public name of the system that answered |',
    '| status | completed or failed |',
    '| exact_match | true when the final answer equals the expected one (tests with one known answer); empty otherwise |',
    '| reviewers_mean_score | mean of the reviewers\' scores, out of 10 (tests scored by reviewers); empty otherwise |',
    '| reviewers | number of reviewers that scored the answer |',
    '| total_ms | time to the complete answer, in milliseconds |',
    '| first_token_ms | time to the first text, in milliseconds |',
    '| cost_usd | cost of the answer in US dollars, computed by the platform from the token counts and the price table in force |', '',
    '## Method of calculation', '',
    ...rules.map((rule) => `- ${rule}`), '',
    'The statements of the tasks and the texts of the answers are not published. Every published figure can be recomputed from these rows:',
    '`python3 recalc/recalculate.py packs/<test>` in the public proof repository.', '',
    `Holder: ${HOLDER}. Licence of the data: CC BY 4.0.`, '',
  ].filter((line) => line !== '' || true).join('\n').replace(/\n{3,}/g, '\n\n');
}

/**
 * The folder of a Kaggle dataset for an edition: files plus `dataset-metadata.json`. The upload itself is made by
 * the official Kaggle client in the workflow. Returns [{ name, bytes }].
 */
export async function kaggleFolder({ read, owner, slug, pdf = null, doi = null, report = null, repository = null }) {
  if (!/^[a-z0-9][a-z0-9-]{2,49}$/.test(owner) || !/^[a-z0-9][a-z0-9-]{5,49}$/.test(slug)) throw new Error('the owner or the name of the dataset is not a simple slug');
  const { plan, manifest, resultsName, files } = await editionFiles(read, pdf);
  const results = JSON.parse(new TextDecoder().decode(files.find((file) => file.name === resultsName).bytes));
  const title = String(manifest.test?.title ?? 'Official test').replace(/^NEOLABS /, 'NEO AI Evaluations - ');
  const readme = dataDictionary({ manifest, digest: plan.manifest_sha256, doi, report, repository, pdfName: pdf?.name ?? null });
  const metadata = {
    title: title.slice(0, 50),
    id: `${owner}/${slug}`,
    subtitle: 'Per-task public results of an official test of LILI, with its manifest'.slice(0, 80),
    description: readme,
    licenses: [{ name: 'CC-BY-4.0' }],
    keywords: [],
  };
  return [
    ...files.filter((file) => file.name !== 'manifest.jcs'),
    { name: 'results.csv', bytes: text(resultsCsv(manifest, results)) },
    { name: 'README.md', bytes: text(readme) },
    { name: 'dataset-metadata.json', bytes: text(`${JSON.stringify(metadata, null, 2)}\n`) },
  ];
}
