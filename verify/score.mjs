// score.mjs - recomputes the published figures of an official test from its public results, with the rules of the
// Model Lab report (origin-server/src/lab/report.ts): same order of the rows, same seeds, same tests.
// Input: a `neolabs.public-results/1` document. No network, no model call.

import { excludesZero, holm, mean, meanCi, medianCi, signFlipP } from './stats.mjs';

export const MIN_PAIRS_FOR_CLAIM = 10;
const MEASURES = ['quality', 'exact', 'total_ms', 'cost'];

/** The judged quality of a row: the mean of its reviewers' scores, `null` without a score. */
export function qualityOf(row) {
  const scores = (row.scores ?? []).filter((score) => typeof score === 'number');
  return scores.length === 0 ? null : mean(scores);
}

function orderSystems(rows) {
  const isProfile = (system) => system.startsWith('profile:');
  return [...new Set(rows.map((row) => row.system))].sort((a, b) => (isProfile(a) === isProfile(b) ? (a < b ? -1 : a > b ? 1 : 0) : isProfile(a) ? -1 : 1));
}

export function score(results) {
  const seed = results.seed;
  const rows = results.rows.filter((row) => row.current_events !== true);
  const systems = orderSystems(results.rows);
  const table = systems.map((system) => {
    const mine = rows.filter((row) => row.system === system);
    const done = mine.filter((row) => row.status === 'completed');
    return {
      system,
      answers: mine.length,
      completed: done.length,
      quality: meanCi(done.map(qualityOf).filter((value) => value !== null), `${seed}:overall:q:${system}`),
      total_ms: medianCi(done.map((row) => row.total_ms).filter((value) => value !== null && value !== undefined), `${seed}:overall:t:${system}`),
      cost_micro_usd: meanCi(done.map((row) => row.cost_micro_usd).filter((value) => value !== null && value !== undefined), `${seed}:overall:c:${system}`),
    };
  });

  const scored = rows.filter((row) => row.status === 'completed');
  const profiles = [...new Set(scored.map((row) => row.system).filter((system) => system.startsWith('profile:')))].sort();
  const models = [...new Set(scored.map((row) => row.system).filter((system) => system.startsWith('model:')))].sort();
  const byKey = new Map(scored.map((row) => [`${row.system}|${row.task_id}`, row]));
  const valueOf = (row, measure) => {
    if (measure === 'quality') return qualityOf(row);
    if (measure === 'exact') return row.exact_match === null || row.exact_match === undefined ? null : row.exact_match ? 1 : 0;
    if (measure === 'total_ms') return row.total_ms ?? null;
    return row.cost_micro_usd ?? null;
  };
  const drafts = [];
  for (const profile of profiles) {
    for (const model of models) {
      for (const measure of MEASURES) {
        const diffs = [];
        for (const row of scored.filter((entry) => entry.system === profile)) {
          const other = byKey.get(`${model}|${row.task_id}`);
          if (other === undefined) continue;
          const a = valueOf(row, measure);
          const b = valueOf(other, measure);
          if (a !== null && b !== null) diffs.push(a - b);
        }
        const key = `${seed}:${profile}:${model}:${measure}`;
        drafts.push({ measure, profile, model, pairs: diffs.length, difference: meanCi(diffs, `${key}:ci`), p: diffs.length >= MIN_PAIRS_FOR_CLAIM ? signFlipP(diffs, `${key}:p`) : null });
      }
    }
  }
  const rejected = holm(drafts.map((draft) => draft.p));
  const claims = drafts.map((draft, index) => ({ ...draft, supported: rejected[index] === true && draft.pairs >= MIN_PAIRS_FOR_CLAIM && excludesZero(draft.difference) }));

  const done = rows.filter((row) => row.status === 'completed');
  const tasks = [...new Set(rows.map((row) => row.task_id))];
  const two = done.map((row) => (row.scores ?? []).filter((s) => typeof s === 'number')).filter((scores) => scores.length >= 2);
  const gaps = two.map((scores) => Math.abs(scores[0] - scores[1]));
  return {
    systems: table,
    claims,
    comparisons: claims.length,
    supported: claims.filter((claim) => claim.supported).length,
    judging: {
      answers: rows.length,
      answers_scored: done.filter((row) => qualityOf(row) !== null).length,
      answers_with_two_scores: two.length,
      scores: done.reduce((n, row) => n + (row.scores ?? []).filter((s) => typeof s === 'number').length, 0),
      tasks: tasks.length,
      tasks_all_systems_scored: tasks.filter((task) => systems.every((system) => { const row = byKey.get(`${system}|${task}`); return row !== undefined && qualityOf(row) !== null; })).length,
      mean_absolute_difference: mean(gaps),
      within_one_point: gaps.length === 0 ? null : gaps.filter((gap) => gap <= 1).length / gaps.length,
    },
    by_status: rows.reduce((acc, row) => ({ ...acc, [row.status]: (acc[row.status] ?? 0) + 1 }), {}),
  };
}

/** The published figures a manifest carries, taken from a recomputation: plain numbers, full precision. */
export function publishedOf(recomputed) {
  const est = (e) => ({ value: e.value, low: e.low, high: e.high, n: e.n });
  return {
    systems: Object.fromEntries(recomputed.systems.map((row) => [row.system, { answers: row.answers, completed: row.completed, quality: est(row.quality), total_ms: est(row.total_ms), cost_micro_usd: est(row.cost_micro_usd) }])),
    claims: recomputed.claims.map((claim) => ({ measure: claim.measure, profile: claim.profile, model: claim.model, pairs: claim.pairs, difference: est(claim.difference), p: claim.p, supported: claim.supported })),
    comparisons: recomputed.comparisons,
    supported: recomputed.supported,
    judging: recomputed.judging,
  };
}

/** Every difference between two sets of figures, as { path, published, recomputed }. Numbers match within 1e-9. */
export function differences(published, recomputed, path = '') {
  if (typeof published === 'number' && typeof recomputed === 'number') {
    return Math.abs(published - recomputed) <= 1e-9 * Math.max(1, Math.abs(published)) ? [] : [{ path, published, recomputed }];
  }
  if (published === null || recomputed === null || typeof published !== 'object' || typeof recomputed !== 'object') {
    return Object.is(published, recomputed) ? [] : [{ path, published, recomputed }];
  }
  const keys = new Set([...Object.keys(published), ...Object.keys(recomputed)]);
  return [...keys].flatMap((key) => differences(published[key], recomputed[key], path === '' ? key : `${path}.${key}`));
}
