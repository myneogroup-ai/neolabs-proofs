# Independent recalculation

`recalculate.py` recomputes the published indicators of an evidence pack from its public files, and prints the
announced value, the recalculated value and the difference for each one. It is a second implementation of the rules
the manifest states: Python, standard library only, no code shared with `verify/*.mjs`. It calls no model.

```
python3 recalc/recalculate.py packs/test-3
python3 recalc/recalculate.py https://raw.githubusercontent.com/myneogroup-ai/neolabs-proofs/main/packs/test-3
```

Exit code 0: every recomputable indicator matches. 1: a difference exists (both values are printed). 2: the pack
cannot be read. An indicator the public data cannot recompute is reported as "Insufficient public data".

`gitlab-ci.yml` is the pipeline of the public GitLab project that runs this program on GitLab's hosted runners for
each edition ("Indicators recalculated on GitLab's infrastructure from the public data"). The link to the exact
pipeline of an edition is recorded in `packs/<test>/publication-index.json` once it has run.
