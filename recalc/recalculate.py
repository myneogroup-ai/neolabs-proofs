#!/usr/bin/env python3
"""Independent recalculation of the published indicators of a NEO AI Evaluations evidence pack.

This program shares no code with the public verifier (verify/*.mjs): it is a second implementation, in another
language, of the rules the manifest of the pack states. It reads two public files only, `manifest.json` and the
results file the manifest names, from a folder or from a public address. It calls no model and no NEO AI service.

    python3 recalculate.py packs/test-3
    python3 recalculate.py https://raw.githubusercontent.com/myneogroup-ai/neolabs-proofs/main/packs/test-3

Output: a table "announced / recalculated / difference" for every indicator, written to the standard output, to
`recalc-report.md` and to `recalc-report.json` (option --out <folder>). An indicator the public data cannot
recompute is reported as "Insufficient public data", never guessed.
Exit code: 0 when every recomputable indicator matches, 1 when a difference exists, 2 when the pack cannot be read.
Standard library only.
"""
import hashlib
import json
import os
import sys
import urllib.request
from datetime import datetime, timezone

TOLERANCE = 1e-9  # relative; integers must be equal


def read(location, name):
    if location.startswith('https://'):
        with urllib.request.urlopen(location.rstrip('/') + '/' + name, timeout=60) as response:
            return response.read()
    with open(os.path.join(location, name), 'rb') as handle:
        return handle.read()


def median(values):
    ordered = sorted(values)
    if not ordered:
        return None
    middle = len(ordered) // 2
    return ordered[middle] if len(ordered) % 2 else (ordered[middle - 1] + ordered[middle]) / 2


def mean(values):
    return sum(values) / len(values) if values else None


def numbers(rows, key):
    return [row[key] for row in rows if isinstance(row.get(key), (int, float)) and not isinstance(row.get(key), bool)]


def known_answer_measures(rows):
    """Rules of a test on tasks with one known answer (the manifest lists them under metrics.known_answers.rules)."""
    exact = sum(1 for row in rows if row.get('exact_match') is True)
    costs = numbers(rows, 'cost_micro_usd')
    completed = [row for row in rows if row.get('status') == 'completed']
    measures = {
        'answers': len(rows),
        'completed': len(completed),
        'exact': exact,
        'exact_rate': exact / len(rows) if rows else None,
        'mean_cost_micro_usd': mean(costs),
        'median_cost_micro_usd': median(costs),
        'cost_per_success_micro_usd': sum(costs) / exact if exact else None,
        'median_total_ms': median(numbers(completed, 'total_ms')),
    }
    for name in sorted({row.get('class') for row in rows if row.get('class')}):
        mine = [row for row in rows if row.get('class') == name]
        measures['exact in class ' + name] = sum(1 for row in mine if row.get('exact_match') is True)
    return measures


def judged_measures(rows):
    """Rules of a test scored by reviewers (metrics.rules): quality of an answer = mean of its reviewers' scores."""
    completed = [row for row in rows if row.get('status') == 'completed']
    quality = []
    for row in completed:
        scores = [s.get('score') if isinstance(s, dict) else s for s in (row.get('scores') or [])]
        scores = [s for s in scores if isinstance(s, (int, float)) and not isinstance(s, bool)]
        if scores:
            quality.append(sum(scores) / len(scores))
    return {
        'answers': len(rows),
        'completed': len(completed),
        'quality (mean, points out of 10)': mean(quality),
        'quality (scored answers)': len(quality),
        'median_total_ms': median(numbers(completed, 'total_ms')),
        'mean_cost_micro_usd': mean(numbers(completed, 'cost_micro_usd')),
    }


def announced_known(published):
    out = {key: published.get(key) for key in ('answers', 'completed', 'exact', 'exact_rate', 'mean_cost_micro_usd',
                                                'median_cost_micro_usd', 'cost_per_success_micro_usd', 'median_total_ms')}
    for name, value in (published.get('by_class') or {}).items():
        out['exact in class ' + name] = value.get('exact')
    return out


def announced_judged(published):
    quality = published.get('quality') or {}
    return {
        'answers': published.get('answers'),
        'completed': published.get('completed'),
        'quality (mean, points out of 10)': quality.get('value'),
        'quality (scored answers)': quality.get('n'),
        'median_total_ms': (published.get('total_ms') or {}).get('value'),
        'mean_cost_micro_usd': (published.get('cost_micro_usd') or {}).get('value'),
    }


def compare(announced, recalculated):
    if announced is None and recalculated is None:
        return 'match', 0
    if announced is None or recalculated is None:
        return 'insufficient', None
    difference = recalculated - announced
    if isinstance(announced, int) and isinstance(recalculated, int):
        return ('match' if difference == 0 else 'difference'), difference
    scale = max(abs(announced), abs(recalculated), 1e-12)
    return ('match' if abs(difference) / scale <= TOLERANCE else 'difference'), difference


def thresholds(measures, rule):
    """The two conditions a protocol fixed before the run; both must hold."""
    subject = measures.get(rule['subject'], {})
    references = [measures.get(name, {}) for name in rule['references']]
    costs = [r.get('cost_per_success_micro_usd') for r in references if r.get('cost_per_success_micro_usd') is not None]
    rates = [r.get('exact_rate') for r in references if r.get('exact_rate') is not None]
    reduction = gap = None
    if costs and subject.get('cost_per_success_micro_usd') is not None:
        reduction = 1 - subject['cost_per_success_micro_usd'] / min(costs)
    if rates and subject.get('exact_rate') is not None:
        gap = (max(rates) - subject['exact_rate']) * 100
    cost_met = reduction is not None and reduction >= rule['cost_reduction_min']
    accuracy_met = gap is not None and gap <= rule['accuracy_gap_max_points']
    return {'cost_reduction': reduction, 'accuracy_gap_points': gap, 'cost_met': cost_met, 'accuracy_met': accuracy_met,
            'met': cost_met and accuracy_met}


def fmt(value):
    if value is None:
        return '-'
    if isinstance(value, bool):
        return 'yes' if value else 'no'
    if isinstance(value, int):
        return str(value)
    return ('%.6f' % value).rstrip('0').rstrip('.')


def main(argv):
    if len(argv) < 2:
        print(__doc__)
        return 2
    location = argv[1]
    out = argv[argv.index('--out') + 1] if '--out' in argv else '.'
    try:
        manifest_bytes = read(location, 'manifest.json')
        manifest = json.loads(manifest_bytes)
        results_name = manifest['results']['file']
        results_bytes = read(location, results_name)
        results = json.loads(results_bytes)
    except Exception as error:  # the pack cannot be read: nothing is recomputed, nothing is guessed
        print('The pack cannot be read: %s' % error)
        return 2

    results_sha = hashlib.sha256(results_bytes).hexdigest()
    declared_sha = next((f['sha256'] for f in manifest.get('files', []) if f.get('path') == results_name), None)
    rows = results['rows']
    names = manifest.get('versions', {}).get('systems', {})
    known = manifest.get('metrics', {}).get('known_answers')
    published = (known or manifest['metrics'])['published']['systems']

    lines, differences, insufficient, measures = [], 0, 0, {}
    for system in sorted({row['system'] for row in rows}):
        mine = [row for row in rows if row['system'] == system]
        recalculated = known_answer_measures(mine) if known else judged_measures(mine)
        measures[system] = recalculated
        announced = (announced_known if known else announced_judged)(published.get(system, {}))
        for indicator in recalculated:
            status, difference = compare(announced.get(indicator), recalculated[indicator])
            differences += status == 'difference'
            insufficient += status == 'insufficient'
            lines.append({'system': names.get(system, system), 'indicator': indicator, 'announced': announced.get(indicator),
                          'recalculated': recalculated[indicator], 'difference': difference, 'status': status})

    outcome = None
    rule = manifest.get('campaign', {}).get('thresholds')
    if known and rule:
        outcome = thresholds(measures, rule)
        # The manifest fixes the two targets; the outcome is not a published figure, it is recomputed here.
        lines.append({'system': 'Target fixed before the run', 'indicator': 'cost per successful task: reduction against the cheaper reference (minimum)',
                      'announced': rule['cost_reduction_min'], 'recalculated': outcome['cost_reduction'], 'difference': None,
                      'status': 'met' if outcome['cost_met'] else 'not_met'})
        lines.append({'system': 'Target fixed before the run', 'indicator': 'exact answers: gap to the best reference, in points (maximum)',
                      'announced': rule['accuracy_gap_max_points'], 'recalculated': outcome['accuracy_gap_points'], 'difference': None,
                      'status': 'met' if outcome['accuracy_met'] else 'not_met'})

    file_status = 'match' if declared_sha == results_sha else 'difference'
    differences += file_status == 'difference'
    report = {
        'schema': 'neo-ai-evaluations.recalculation/1',
        'test': manifest.get('test', {}).get('id'),
        'source': location,
        'manifest_file_sha256': hashlib.sha256(manifest_bytes).hexdigest(),
        'results_file': {'name': results_name, 'sha256': results_sha, 'declared_sha256': declared_sha, 'status': file_status},
        'rows': len(rows),
        'runner': os.environ.get('CI_SERVER_HOST') or os.environ.get('GITHUB_SERVER_URL') or 'local',
        'job_url': os.environ.get('CI_JOB_URL'),
        'pipeline_url': os.environ.get('CI_PIPELINE_URL'),
        'recalculated_at': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'summary': {'indicators': len(lines), 'match': sum(1 for l in lines if l['status'] == 'match'),
                    'difference': differences, 'insufficient_public_data': insufficient},
        'targets': outcome,
        'indicators': lines,
    }
    label = {'match': 'Match', 'difference': 'DIFFERENCE', 'insufficient': 'Insufficient public data', 'met': 'Target met', 'not_met': 'Target not met'}
    text = ['# Independent recalculation - %s' % report['test'], '',
            'Source: %s' % location,
            'Results file %s: SHA-256 %s (%s the manifest)' % (results_name, results_sha, 'as declared by' if file_status == 'match' else 'DIFFERENT FROM'),
            '%d rows. No model and no NEO AI service was called.' % len(rows), '',
            '| System | Indicator | Announced (or target) | Recalculated | Difference | Status |', '|---|---|---|---|---|---|']
    for l in lines:
        text.append('| %s | %s | %s | %s | %s | %s |' % (l['system'], l['indicator'], fmt(l['announced']), fmt(l['recalculated']), fmt(l['difference']), label[l['status']]))
    text += ['', '%d indicators: %d match, %d difference, %d with insufficient public data.' % (
        len(lines), report['summary']['match'], differences, insufficient)]
    os.makedirs(out, exist_ok=True)
    with open(os.path.join(out, 'recalc-report.json'), 'w') as handle:
        json.dump(report, handle, indent=2)
    with open(os.path.join(out, 'recalc-report.md'), 'w') as handle:
        handle.write('\n'.join(text) + '\n')
    print('\n'.join(text))
    return 1 if differences else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
