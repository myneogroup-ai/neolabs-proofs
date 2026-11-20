# NEOLABS proofs

Public evidence packs of the Official LILI Capability Tests of NEO AI (https://lilineo.com/neolabs/), and the code
that verifies them. Nothing here calls an AI model.

- `packs/<test>/manifest.json` - what was tested, every file with its SHA-256, the published figures and their rules.
  Its fingerprint is the SHA-256 of its RFC 8785 form.
- `packs/<test>/results.json` - one row per task and system: status, time, cost, reviewers' scores. No prompt, no
  answer, no reviewer name, no provider of a LILI profile.
- `packs/<test>/publication-index.json` - the external proofs added after the manifest was sealed, each in its real
  state: verified, pending, discrepancy, insufficient data, not applicable.
- `verify/` - the scorer and the checks. `node verify/cli.mjs verify packs/<test>` runs them offline (Node 20+).

What a pack proves: the files are the ones NEO AI sealed, at the attested dates, and the published figures are the
correct aggregation of the per-task results. What it does not prove: the reviewers' scores are the judgement of AI
models, recorded at the time; an independent validation of performance has not been performed.

## Licence

The code (`verify/`, the workflow) is under the MIT licence (`LICENSE`). The data of the packs are under
CC BY 4.0 (`LICENSE-DATA.md`). The PDF reports remain all rights reserved by NEO AI.
