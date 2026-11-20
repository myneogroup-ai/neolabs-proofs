#!/usr/bin/env node
// cli.mjs - NEOLABS evidence packs from the command line. No dependency, no network, no model call.
//   node cli.mjs verify <folder>            runs every check; exit 1 on a discrepancy
//   node cli.mjs build <config.json> <out>  writes manifest.json, results.json and an empty publication index
//   node cli.mjs digest <manifest.json>     prints the SHA-256 of the RFC 8785 form of a manifest
//   node cli.mjs canonical <manifest.json>  the RFC 8785 bytes of a manifest (what is signed and time-stamped)
//   node cli.mjs plan <folder> <provider>   create | follow | skip: a provider is never published twice per manifest
//   node cli.mjs proof <folder> '<json>'    records one external proof in the publication index
//   node cli.mjs sample <ids.json> <randomness-hex> <size>   the public sample of a drand round
import { mkdirSync, readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { canonicalize } from './jcs.mjs';
import { INDEX_SCHEMA, buildManifest, checkPack, manifestDigest, publicationPlan, summary, withProof } from './pack.mjs';
import { drawSample } from './sample.mjs';

const LABEL = { verified: 'VERIFIED', pending: 'PENDING', discrepancy: 'DISCREPANCY', insufficient: 'INSUFFICIENT DATA', not_applicable: 'NOT APPLICABLE' };

export const folderReader = (folder) => async (path) => {
  const full = resolve(folder, path);
  if (!full.startsWith(resolve(folder))) return null;
  return existsSync(full) ? new Uint8Array(readFileSync(full)) : null;
};

/** Builds a pack from a config: { test, campaign, versions, results, files: [{ path, role, source }], ledger, timestamps, costs, limits, generated_at }. */
export async function buildPack(configPath, out) {
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  const base = dirname(resolve(configPath));
  const results = JSON.parse(readFileSync(resolve(base, config.results), 'utf8'));
  mkdirSync(out, { recursive: true });
  const resultsBytes = new TextEncoder().encode(`${canonicalize(results)}\n`);
  const files = [{ path: 'results.json', role: 'Per-task results (public rows)', bytes: resultsBytes }];
  for (const file of config.files ?? []) files.push({ path: file.path, role: file.role, bytes: new Uint8Array(readFileSync(resolve(base, file.source))), source: resolve(base, file.source) });
  const manifest = await buildManifest({ ...config, files, results });
  for (const file of files) {
    mkdirSync(dirname(join(out, file.path)), { recursive: true });
    if (file.source) copyFileSync(file.source, join(out, file.path)); else writeFileSync(join(out, file.path), file.bytes);
  }
  writeFileSync(join(out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  const digest = await manifestDigest(manifest);
  const indexPath = join(out, 'publication-index.json');
  const previous = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, 'utf8')) : null;
  if (previous === null || previous.manifest_sha256 !== digest) writeFileSync(indexPath, `${JSON.stringify({ schema: INDEX_SCHEMA, manifest_sha256: digest, updated_at: config.generated_at, proofs: [] }, null, 2)}\n`);
  return { digest, manifest };
}

async function main(argv) {
  const [command, ...args] = argv;
  if (command === 'verify') {
    const { manifest_sha256, checks } = await checkPack(folderReader(args[0] ?? '.'));
    console.log(`manifest ${manifest_sha256 ?? '(none)'}`);
    for (const check of checks) console.log(`${LABEL[check.status].padEnd(18)} ${check.title}${check.detail ? ` - ${check.detail}` : ''}`);
    const total = summary(checks);
    console.log(`\n${String(total.verified)} verified, ${String(total.pending)} pending, ${String(total.discrepancy)} discrepancy, ${String(total.insufficient)} insufficient data, ${String(total.not_applicable)} not applicable`);
    return total.ok ? 0 : 1;
  }
  if (command === 'build') { const { digest } = await buildPack(args[0], args[1]); console.log(digest); return 0; }
  if (command === 'digest') { console.log(await manifestDigest(JSON.parse(readFileSync(args[0], 'utf8')))); return 0; }
  if (command === 'canonical') { process.stdout.write(canonicalize(JSON.parse(readFileSync(args[0], 'utf8')))); return 0; }
  if (command === 'plan' || command === 'proof') {
    const manifest = JSON.parse(readFileSync(join(args[0], 'manifest.json'), 'utf8'));
    const digest = await manifestDigest(manifest);
    const indexPath = join(args[0], 'publication-index.json');
    const index = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, 'utf8')) : null;
    if (command === 'plan') { console.log(publicationPlan(index, args[1], digest)); return 0; }
    const proof = JSON.parse(args[1]);
    writeFileSync(indexPath, `${JSON.stringify(withProof(index, digest, proof, args[2] ?? new Date().toISOString()), null, 2)}\n`);
    return 0;
  }
  if (command === 'sample') { console.log(JSON.stringify(await drawSample(JSON.parse(readFileSync(args[0], 'utf8')), args[1], Number(args[2])))); return 0; }
  console.error('usage: cli.mjs verify <folder> | build <config.json> <out> | digest <manifest.json> | sample <ids.json> <randomness> <size>');
  return 2;
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv.slice(2)).then((code) => process.exit(code), (error) => { console.error(error.message); process.exit(2); });
