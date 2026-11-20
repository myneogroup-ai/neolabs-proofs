// verify-page.js - "Verify this report": every check of an evidence pack, run in the visitor's browser.
// No server function, no model call: the page fetches the public files of the pack (or reads a folder the visitor
// downloaded) and runs neolabs/verify/pack.mjs on them.
import { checkPack, summary } from '../pack.mjs';

const GROUPS = [
  ['integrity', 'Identity and integrity', 'Signature, workflow identity and file fingerprints'],
  ['date', 'Attested date', 'Time-stamps and the state of each external proof'],
  ['provenance', 'Provenance', 'LILI version, scorer commit and Proof Ledger reference'],
  ['protocol', 'Protocol', 'Preregistration, when it exists, with its date'],
  ['scores', 'Scores', 'Published figures, recomputed figures and any difference'],
  ['costs', 'Costs', 'Reconciled amounts, estimates and scope'],
  ['sample', 'Sample', 'drand round, rule of the draw and inclusion proofs'],
  ['downloads', 'Downloads', 'Report, signed manifest, proofs, DOI and public results'],
];
const LABEL = { verified: 'Verified', pending: 'Pending', discrepancy: 'Discrepancy detected', insufficient: 'Insufficient data', not_applicable: 'Not applicable' };
const el = (tag, attrs = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) if (key === 'class') node.className = value; else node.setAttribute(key, value);
  for (const child of children) node.append(child);
  return node;
};

function render(root, base, result) {
  root.replaceChildren();
  const total = summary(result.checks);
  const headline = total.discrepancy > 0 ? 'A discrepancy was detected. Do not rely on this copy of the report.'
    : total.pending > 0 ? 'No discrepancy. Some external proofs are still pending.'
      : 'No discrepancy in the checks this page can run.';
  root.append(el('div', { class: `nv-sum ${total.discrepancy > 0 ? 'bad' : 'good'}` },
    el('strong', {}, headline),
    el('span', {}, `${total.verified} verified · ${total.pending} pending · ${total.discrepancy} discrepancy · ${total.insufficient} insufficient data · ${total.not_applicable} not applicable`),
    el('code', {}, result.manifest_sha256 ? `Manifest SHA-256 (RFC 8785): ${result.manifest_sha256}` : 'No manifest')));
  const manifest = result.manifest;
  for (const [id, title, hint] of GROUPS) {
    const checks = result.checks.filter((check) => check.group === id);
    const section = el('section', { class: 'nv-group' }, el('h2', {}, title), el('p', { class: 'nv-hint' }, hint));
    if (id === 'provenance' && manifest) {
      const v = manifest.versions ?? {};
      section.append(el('p', { class: 'nv-meta' }, `LILI: ${v.lili?.commit ?? 'not recorded'} · scorer: ${v.scorer?.name ?? ''} ${v.scorer?.commit ?? v.scorer?.version ?? ''} · task set: ${manifest.campaign?.task_set_version ?? ''}`));
      section.append(el('p', { class: 'nv-meta' }, `Execution declared by NEO AI: ${manifest.campaign?.declared_started_at ?? '?'} to ${manifest.campaign?.declared_finished_at ?? '?'} · pack generated: ${manifest.generated_at}`));
    }
    if (id === 'downloads' && manifest) {
      const list = el('ul', { class: 'nv-files' });
      for (const file of [{ path: 'manifest.json' }, { path: 'publication-index.json' }, ...manifest.files]) list.append(el('li', {}, base ? el('a', { href: `${base}${file.path}`, download: '' }, file.path) : file.path, file.sha256 ? el('small', {}, ` SHA-256 ${file.sha256}`) : ''));
      section.append(list);
    }
    if (checks.length === 0 && id !== 'downloads') section.append(el('p', { class: 'nv-row' }, el('span', { class: 'nv-s not_applicable' }, LABEL.not_applicable), el('span', {}, 'Nothing is recorded for this control.')));
    for (const check of checks) section.append(el('p', { class: 'nv-row' }, el('span', { class: `nv-s ${check.status}` }, LABEL[check.status]), el('span', {}, el('b', {}, check.title), check.detail ? ` ${check.detail}` : '')));
    root.append(section);
  }
}

async function run(root, read, base) {
  root.replaceChildren(el('p', { class: 'nv-hint' }, 'Checking the files...'));
  try { render(root, base, await checkPack(read)); } catch (error) { root.replaceChildren(el('p', { class: 'nv-row' }, el('span', { class: 'nv-s discrepancy' }, 'Error'), el('span', {}, String(error.message)))); }
}

export function start() {
  const root = document.getElementById('nv-out');
  // getAll, not get: the i18n check of lilineo.com reads get('...') as a translation key.
  const base = new URLSearchParams(location.search).getAll('pack')[0] ?? document.body.dataset.pack ?? '';
  const safe = /^\/neolabs\/proof\/[a-z0-9-]+\/pack\/$/.test(base) ? base : '';
  if (safe !== '') run(root, async (path) => { const response = await fetch(`${safe}${path}`, { cache: 'no-store' }); return response.ok ? new Uint8Array(await response.arrayBuffer()) : null; }, safe);
  else root.replaceChildren(el('p', { class: 'nv-hint' }, 'Choose the folder of a downloaded evidence pack to verify it on this device.'));
  document.getElementById('nv-folder').addEventListener('change', (event) => {
    const files = new Map();
    for (const file of event.target.files) files.set(file.webkitRelativePath.split('/').slice(1).join('/'), file);
    run(root, async (path) => (files.has(path) ? new Uint8Array(await files.get(path).arrayBuffer()) : null), '');
  });
}
