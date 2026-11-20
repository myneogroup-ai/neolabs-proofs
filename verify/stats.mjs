// stats.mjs - the statistics of the Model Lab report, the published copy of origin-server/src/lab/stats.ts.
// Pure and deterministic: the same data and the same seed give the same numbers. A test of the platform checks that
// this file and the platform's own code give identical results on the same campaign.

export const BOOTSTRAP_RESAMPLES = 2000;
export const PERMUTATIONS = 20000;

export function seededRandom(seed) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let state = h >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function mean(values) {
  return values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;
}

export function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function percentile(sorted, p) {
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(p * sorted.length)))];
}

export function bootstrap(values, statistic, seed) {
  const value = statistic(values);
  if (values.length < 2 || value === null) return { value, low: null, high: null, n: values.length };
  const random = seededRandom(seed);
  const stats = [];
  const sample = new Array(values.length);
  for (let r = 0; r < BOOTSTRAP_RESAMPLES; r += 1) {
    for (let i = 0; i < values.length; i += 1) sample[i] = values[Math.floor(random() * values.length)];
    const s = statistic(sample);
    if (s !== null) stats.push(s);
  }
  stats.sort((a, b) => a - b);
  return { value, low: percentile(stats, 0.025), high: percentile(stats, 0.975), n: values.length };
}

export const meanCi = (values, seed) => bootstrap(values, mean, seed);
export const medianCi = (values, seed) => bootstrap(values, median, seed);

export function excludesZero(estimate) {
  return estimate.low !== null && estimate.high !== null && (estimate.low > 0 || estimate.high < 0);
}

export function signFlipP(diffs, seed, flips = PERMUTATIONS) {
  if (diffs.length < 2) return null;
  const observed = Math.abs(diffs.reduce((a, b) => a + b, 0));
  const random = seededRandom(seed);
  let extreme = 0;
  for (let r = 0; r < flips; r += 1) {
    let sum = 0;
    for (const d of diffs) sum += random() < 0.5 ? -d : d;
    if (Math.abs(sum) >= observed - 1e-12) extreme += 1;
  }
  return (1 + extreme) / (1 + flips);
}

export function holm(pvalues, alpha = 0.05) {
  const indexed = pvalues.map((p, index) => ({ p, index })).filter((entry) => entry.p !== null).sort((a, b) => a.p - b.p);
  const rejected = pvalues.map(() => false);
  const m = indexed.length;
  for (const [rank, entry] of indexed.entries()) {
    if (entry.p > alpha / (m - rank)) break;
    rejected[entry.index] = true;
  }
  return rejected;
}
