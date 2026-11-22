# NEOLABS Official Test No. 3 - protocol

Published by NEO TECH LABS TECHNOLOGY L.L.C. on 22 November 2026, before the run. This file is time-stamped by third
parties before the first answer of the run is requested. Nothing in it is changed afterwards: a correction is a new
file that names this one.

## 1. Question

On tasks that have one known answer, does NEO AUTO reach a rate of exact answers close to that of two reference
systems, at a lower cost per successful task?

This test does not ask whether NEO AUTO is more accurate than the reference systems. The calibration pass described in
section 7 showed that it is not on these tasks.

## 2. Systems

| System | Role |
| --- | --- |
| NEO AUTO | LILI profile, subject of the thresholds of section 5 |
| NEO PULSE | LILI profile, reported, no threshold |
| NEO PRIME | LILI profile, reported, no threshold |
| Claude Opus 5.5 | reference, called directly |
| GPT-5.5 | reference, called directly |

Each system receives the same task text, once, in a new conversation with no history, no file and no memory. Every
call is a live call of the product in production. The platform's standard limits (time, output length) apply to the
five systems alike.

## 3. Tasks

99 tasks of the Model Lab task set v6-2026-11-22: 36 of reasoning, 36 of data, 27 of code; 49 in English, 50 in French.
Each task has one expected answer, computed by a program before the run and checked by a second program.

- List of the task ids (JSON array, in this order): SHA-256 `6eced5c95ce0ac3271d986f993543ddc21d97e38971346d4aa49f47ce27fdcfc`
- File of the tasks and of their expected answers, as it is in production: SHA-256 `1911e69a7b9197d9b168d974661151201dc759dfff359b1e1a936437bce25add`

The task ids:

```
r107-en r108-fr r109-en r110-fr r111-en r112-fr r113-en r114-fr r115-en r116-fr r117-en r118-fr r119-en r120-fr r121-en r122-fr r123-en r124-fr r125-en r126-fr r127-en r128-fr r129-en r130-fr r131-en r132-fr r133-en r134-fr r135-en r136-fr r137-en r138-fr r139-en r140-fr r141-en r142-fr d75-en d76-fr d77-en d78-fr d79-en d80-fr d81-en d82-fr d83-en d84-fr d85-en d86-fr d87-en d88-fr d89-en d90-fr d91-en d92-fr d93-en d94-fr d95-en d96-fr d97-en d98-fr d99-en d100-fr d101-en d102-fr d103-en d104-fr d105-en d106-fr d107-en d108-fr d109-en d110-fr c58-fr c59-en c60-fr c61-en c62-fr c63-en c64-fr c65-en c66-fr c67-en c68-fr c69-en c70-fr c71-en c72-fr c73-en c74-fr c75-en c76-fr c77-en c78-fr c79-en c80-fr c81-en c82-fr c83-en c84-fr
```

The texts of the tasks and the expected answers are not published before the run. After the run, the ten tasks of the
public sample (section 6) are published in full.

## 4. Measures

For each answer the platform records: the status (completed or failed), the total time, the cost, and whether the final
answer equals the expected answer.

- **Exact answer.** An automatic comparison of the final line of the answer with the expected answer. No reviewer, human
  or AI, scores an answer. A failed answer (time limit, empty answer, provider error) is not a successful task.
- **Cost.** The sum of the usage that the providers report for every call made for the answer, at the published prices,
  including the internal calls of a LILI profile (routing, verification, second attempt). The cost of a failed answer is
  counted.
- **Primary measure: cost per successful task** of a system = the total cost of its 99 answers divided by the number of
  its exact answers.
- **Secondary measures**, for the five systems: rate of exact answers (overall and per class), median total time, mean
  and median cost per answer.

One pass per task. No confidence interval is claimed from one pass; the report says so.

## 5. Thresholds, fixed before the run

The result of the test is "met" only if both conditions hold; otherwise it is "not met". It is published either way,
with every measure of section 4.

1. **Cost.** The cost per successful task of NEO AUTO is at least 30 percent lower than the lowest cost per successful
   task of the two reference systems.
2. **Accuracy guard.** The rate of exact answers of NEO AUTO is not more than 7 percentage points below the highest rate
   of the two reference systems.

No threshold applies to NEO PULSE and NEO PRIME: their measures are published as they are.

## 6. Public sample

Ten tasks are drawn after the run by a public source of randomness that nobody controls: round **34185412** of the
drand quicknet beacon (League of Entropy; chain hash
`52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971`), due at 2026-11-22T15:00:00Z. The sample is the ten
task ids with the smallest SHA-256( randomness of the round, ":" , task id ). The results are frozen and their
fingerprint is time-stamped before that round exists. Anyone recomputes the draw.

## 7. What a reader must know

- **Calibration.** On 22 November 2026 the five systems answered the 102 tasks of the set v6 once. The thresholds of
  section 5 were chosen after reading that pass. They are therefore not blind to the systems' behaviour on these tasks.
- **Excluded tasks.** Three tasks of one family (c55-en, c56-fr, c57-en) are excluded: in the calibration the reference
  systems reached the time limit on them, so they measured the time limit and not the answer. The exclusion was decided
  before this protocol and applies to the five systems.
- **No change between calibration and run.** The platform in production is the same revision for both (commit
  `c0c1ecb` of the platform). If a deployment changes it before the end of the run, the run is void and this protocol
  is not reused.
- **No reuse of an answer.** The run uses temporary conversations, for which the platform never reuses an earlier
  answer.
- **Earlier task sets** served to correct the platform and are not part of this test.
- **Operator.** NEO AI runs the test on its own platform and is the publisher. Nobody outside NEO AI supervised it. The
  evidence pack lets anyone check the integrity of the published files and recompute the published figures from them;
  it does not prove how the run was conducted.

## 8. Interruption and stop rules

- If the server stops during the run, the run is resumed once: only the answers that are missing are requested. The
  interruption and its time are published. A second interruption voids the run.
- A spending limit is set before the run. If it is reached the run stops and is published as incomplete, with the
  result "not met".
- An answer is never requested twice. Nothing is removed after the run.

## 9. What is published

The evidence pack: this protocol, per answer the system, the task id, the status, the total time, the cost and the
exact-answer result; the measures of section 4; the result of section 5; the drand round and the public sample; the
time-stamps and signatures. The names of the models behind a LILI profile and the texts of the answers are not
published.
