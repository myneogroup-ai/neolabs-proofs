#!/usr/bin/env node
// cli.mjs - NEOLABS evidence packs from the command line. No dependency, no model call; no network except `deposit`.
//   node cli.mjs verify <folder>            runs every check; exit 1 on a discrepancy
//   node cli.mjs build <config.json> <out>  writes manifest.json, results.json and an empty publication index
//   node cli.mjs digest <manifest.json>     prints the SHA-256 of the RFC 8785 form of a manifest
//   node cli.mjs canonical <manifest.json>  the RFC 8785 bytes of a manifest (what is signed and time-stamped)
//   node cli.mjs plan <folder> <provider>   create | follow | skip: a provider is never published twice per manifest
//   node cli.mjs proof <folder> '<json>'    records one external proof in the publication index
//   node cli.mjs sample <ids.json> <randomness-hex> <size>   the public sample of a drand round
//   node cli.mjs drand <beacon.json> <chain.json>   checks a drand round (needs `npm install @noble/curves` for the signature)
//   node cli.mjs deposit <folder> <api-base> [repo-url]   deposits the pack in Zenodo or its sandbox (token: DEPOSIT_TOKEN)
//   node cli.mjs huggingface <folder> <name> rehearsal|public   the pack as a Hugging Face dataset (token: DEPOSIT_TOKEN)
//   node cli.mjs osf <protocol-file> <title> rehearsal|public   the protocol of a test in an OSF project (token: DEPOSIT_TOKEN)
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
  if (command === 'drand') {
    // node cli.mjs drand <beacon.json> <chain.json>: 0 verified, 1 discrepancy, 3 not checked (no pairing library).
    const { verifyBeacon } = await import('./drand.mjs');
    let bls = null;
    try { ({ bls12_381: bls } = await import(process.env.NEOLABS_BLS_MODULE ?? '@noble/curves/bls12-381')); } catch { bls = null; }
    const result = await verifyBeacon(JSON.parse(readFileSync(args[1], 'utf8')), JSON.parse(readFileSync(args[0], 'utf8')), bls);
    console.log(`${LABEL[result.status]} ${result.detail}`);
    return result.status === 'verified' ? 0 : result.status === 'discrepancy' ? 1 : 3;
  }
  if (command === 'deposit') {
    // node cli.mjs deposit <folder> <api-base> [repository-url]: the token comes from DEPOSIT_TOKEN, never from an argument.
    const { deposit } = await import('./deposit.mjs');
    const record = await deposit({ api: args[1], token: process.env.DEPOSIT_TOKEN ?? '', repository: args[2] ?? null, read: async (path) => (existsSync(join(args[0], path)) ? new Uint8Array(readFileSync(join(args[0], path))) : null) });
    console.log(JSON.stringify(record, null, 2));
    return 0;
  }
  if (command === 'huggingface') {
    // node cli.mjs huggingface <folder> <dataset-name> rehearsal|public [repository-url]: token from DEPOSIT_TOKEN.
    const { publishToHuggingFace } = await import('./publish.mjs');
    if (args[2] !== 'rehearsal' && args[2] !== 'public') { console.error('the third argument is rehearsal or public'); return 2; }
    const manifest = JSON.parse(readFileSync(join(args[0], 'manifest.json'), 'utf8'));
    const record = await publishToHuggingFace({ token: process.env.DEPOSIT_TOKEN ?? '', name: args[1], title: String(manifest.test?.title ?? 'NEOLABS official test'), repository: args[3] ?? null, rehearsal: args[2] === 'rehearsal', read: async (path) => (existsSync(join(args[0], path)) ? new Uint8Array(readFileSync(join(args[0], path))) : null) });
    console.log(JSON.stringify(record, null, 2));
    return 0;
  }
  if (command === 'osf') {
    // node cli.mjs osf <protocol-file> <title> rehearsal|public: token from DEPOSIT_TOKEN.
    const { depositProtocolOnOsf } = await import('./publish.mjs');
    if (args[2] !== 'rehearsal' && args[2] !== 'public') { console.error('the third argument is rehearsal or public'); return 2; }
    const record = await depositProtocolOnOsf({ token: process.env.DEPOSIT_TOKEN ?? '', protocol: new Uint8Array(readFileSync(args[0])), filename: args[0].split('/').pop(), title: args[1], rehearsal: args[2] === 'rehearsal' });
    console.log(JSON.stringify(record, null, 2));
    return 0;
  }
  if (command === 'internet-archive' || command === 'kaggle-folder') {
    // node cli.mjs internet-archive <folder> <identifier> rehearsal|public [pdf] [doi] [report-url] [repository-url]
    //   keys from IA_ACCESS_KEY and IA_SECRET_KEY; prints the record of the item.
    // node cli.mjs kaggle-folder <folder> <owner> <slug> <out-folder> [pdf] [doi] [report-url] [repository-url]
    //   writes the folder of the Kaggle dataset (the official Kaggle client uploads it).
    const { publishToInternetArchive, kaggleFolder } = await import('./archive.mjs');
    const read = async (path) => (existsSync(join(args[0], path)) ? new Uint8Array(readFileSync(join(args[0], path))) : null);
    const rest = command === 'internet-archive' ? args.slice(3) : args.slice(4);
    const pdf = rest[0] ? { name: rest[0].split('/').pop(), bytes: new Uint8Array(readFileSync(rest[0])) } : null;
    const extra = { pdf, doi: rest[1] || null, report: rest[2] || null, repository: rest[3] || null };
    if (command === 'internet-archive') {
      if (args[2] !== 'rehearsal' && args[2] !== 'public') { console.error('the third argument is rehearsal or public'); return 2; }
      const record = await publishToInternetArchive({ accessKey: process.env.IA_ACCESS_KEY ?? '', secretKey: process.env.IA_SECRET_KEY ?? '', read, identifier: args[1], rehearsal: args[2] === 'rehearsal', ...extra });
      console.log(JSON.stringify(record, null, 2));
      return 0;
    }
    const { mkdirSync, writeFileSync } = await import('node:fs');
    mkdirSync(args[3], { recursive: true });
    for (const file of await kaggleFolder({ read, owner: args[1], slug: args[2], ...extra })) writeFileSync(join(args[3], file.name), file.bytes);
    return 0;
  }
  if (command === 'sample') { console.log(JSON.stringify(await drawSample(JSON.parse(readFileSync(args[0], 'utf8')), args[1], Number(args[2])))); return 0; }
  console.error('usage: cli.mjs verify <folder> | build <config.json> <out> | digest <manifest.json> | sample <ids.json> <randomness> <size> | drand <beacon.json> <chain.json> | deposit <folder> <api-base> [repository-url] | huggingface <folder> <name> rehearsal|public [repository-url] | osf <protocol-file> <title> rehearsal|public');
  return 2;
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv.slice(2)).then((code) => process.exit(code), (error) => { console.error(error.message); process.exit(2); });
