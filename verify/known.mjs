// known.mjs - the measures of a test on tasks with one known answer (Official Test No. 3 onwards), recomputed from
// the public results. No reviewer scores an answer: `exact_match` is the platform's automatic comparison of the final
// answer with the expected one. No network, no model call.
//
// The rules, as the protocol of the test states them:
//   - a successful task is a row whose `exact_match` is true; a failed answer is not a successful task;
//   - the cost of a system is the sum of the cost of ALL its rows, the failed ones included;
//   - cost per successful task = that sum divided by the number of successful tasks (`null` with none);
//   - time: the median total time of the completed rows.

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const numbers = (rows, key) => rows.map((row) => row[key]).filter((value) => typeof value === 'number');

function measuresOf(rows) {
  const exact = rows.filter((row) => row.exact_match === true).length;
  const costs = numbers(rows, 'cost_micro_usd');
  const total = costs.reduce((sum, value) => sum + value, 0);
  return {
    answers: rows.length,
    completed: rows.filter((row) => row.status === 'completed').length,
    exact,
    exact_rate: rows.length === 0 ? null : exact / rows.length,
    total_cost_micro_usd: total,
    mean_cost_micro_usd: costs.length === 0 ? null : total / costs.length,
    median_cost_micro_usd: median(costs),
    cost_per_success_micro_usd: exact === 0 ? null : total / exact,
    median_total_ms: median(numbers(rows.filter((row) => row.status === 'completed'), 'total_ms')),
  };
}

/** The measures of every system, overall and per class of tasks. */
export function knownAnswers(results) {
  const systems = {};
  for (const system of [...new Set(results.rows.map((row) => row.system))].sort()) {
    const mine = results.rows.filter((row) => row.system === system);
    const by_class = {};
    for (const name of [...new Set(mine.map((row) => row.class))].sort()) {
      const rows = mine.filter((row) => row.class === name);
      by_class[name] = { answers: rows.length, exact: rows.filter((row) => row.exact_match === true).length };
    }
    systems[system] = { ...measuresOf(mine), by_class };
  }
  return { systems };
}

/**
 * The outcome of the thresholds a protocol fixed before the run.
 * thresholds = { subject, references: [system], cost_reduction_min (0.30 = 30 percent), accuracy_gap_max_points (7) }.
 * "met" only if both conditions hold; a figure that cannot be computed makes its condition not met.
 */
export function thresholdOutcome(measures, thresholds) {
  const subject = measures.systems[thresholds.subject];
  const references = thresholds.references.map((system) => ({ system, ...(measures.systems[system] ?? {}) }));
  const costs = references.map((ref) => ref.cost_per_success_micro_usd).filter((value) => typeof value === 'number');
  const rates = references.map((ref) => ref.exact_rate).filter((value) => typeof value === 'number');
  const lowestReferenceCost = costs.length === references.length && costs.length > 0 ? Math.min(...costs) : null;
  const highestReferenceRate = rates.length === references.length && rates.length > 0 ? Math.max(...rates) : null;
  const subjectCost = subject?.cost_per_success_micro_usd ?? null;
  const subjectRate = subject?.exact_rate ?? null;
  const reduction = subjectCost === null || lowestReferenceCost === null ? null : 1 - subjectCost / lowestReferenceCost;
  const gap = subjectRate === null || highestReferenceRate === null ? null : (highestReferenceRate - subjectRate) * 100;
  const cost = { id: 'cost', required_reduction: thresholds.cost_reduction_min, subject_cost_per_success_micro_usd: subjectCost, lowest_reference_cost_per_success_micro_usd: lowestReferenceCost, reduction, met: reduction !== null && reduction >= thresholds.cost_reduction_min - 1e-12 };
  const accuracy = { id: 'accuracy_guard', max_gap_points: thresholds.accuracy_gap_max_points, subject_exact_rate: subjectRate, highest_reference_exact_rate: highestReferenceRate, gap_points: gap, met: gap !== null && gap <= thresholds.accuracy_gap_max_points + 1e-9 };
  return { conditions: [cost, accuracy], result: cost.met && accuracy.met ? 'met' : 'not met' };
}
