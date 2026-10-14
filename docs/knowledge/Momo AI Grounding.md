# Momo AI Grounding

## Current local boundary

Generation, chat study-card, and card-import paths apply deterministic source
checks and then a bounded TypeSafe Jev semantic judgment before returning or
persisting generated content. The verifier receives the candidate fields and
its exact cited chunk. Provider failure or an uncertain judgment fails closed.

The deterministic validator remains a lexical precheck. Long answers can
contain all expected terms while assigning a relation to the wrong subject. A
worker regression covers this case: the answer says ribosomes produce ATP while
the cited chunk separately says ribosomes produce proteins and mitochondria
produce ATP. The real verifier client receives that candidate and evidence via
mocked HTTP; a high-confidence `says_nothing` response fails the job before the
study set is persisted.

## Evidence and remaining gates

Focused grounding/source/format/verifier suites passed 232 tests. The full local
loopback PostgreSQL/PostgREST suite passed 936 tests with zero skips, errors, or
failures; the no-skip gate, Ruff (142 files), mypy (76 files), and diff check
passed. Independent review found no blocking issue.

This proves local sequencing and fail-closed behavior, not semantic quality or
threshold calibration. The 0.8 gate remains provisional pending representative
human-reviewed labels. Managed Render provider behavior, Jev data-retention
review, and user disclosure remain open release gates. Lexical prechecks can
reject valid paraphrases; keep AI-02 partial until the quality and privacy gates
are addressed.

For the requested human review, use [[Momo AI-02 Human Grounding Review]]. Its
separate authored-label key is [[Momo AI-02 Human Grounding Review Answer Key]];
keep it closed until labels are recorded. Preparing the sheet made no Jev/API
request and does not calibrate the threshold.

See [[Momo Backend Completion 2026-10-14]] and [[docs/backend-readiness-2026-10-14|dated verification]].
