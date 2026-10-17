# Compaction carry comparison — 2026-10-17

PC native in-app Chromium/WebGPU, product3ed5b4802c79ade6 (`index-7lsemY2t.js`). Explicit developer route, prepared pinned Bonsai4B revision8d6557168168f91ea6697a4a49ed2ef622b53adb, runtime621e20782f208660f4f58283c2ce58430020f243, context2048, greedy, resetSession=true for each case, actual192-token output allocation. No knowledge records, personal conversations, downloads or remote inference. This is a narrow transport comparison, not phone acceptance or a semantic benchmark.

`node research/compaction-carry.mjs 1` creates the first public fixture. Load it through `/?check=harness`, Run comparison, and retain the completed page report. Generate each later fixture with `node research/compaction-carry.mjs 2 <cycle1-report>` and `node research/compaction-carry.mjs 3 <cycle2-report>`. Each branch carries its own actual preceding output, trimmed exactly as production compaction does. No unescaping, substituted oracle or regenerated answer is used. The old branch reproduces the previous regular JSON carrier; the literal branch uses the exported production helper. Oversized-fragment transport is covered by exact-byte/control tests, not by these six GPU generations.

| Cycle | Old input/output tokens | Literal input/output tokens | Old longest backslash run | Literal longest run |
| --- | --- | --- | --- | --- |
|1|189/77|212/66|2|1|
|2|219/78|227/62|4|1|
|3|221/77|223/57|2|1|

All six completed with finishReason=stop, stopped=false, no parse error, and retained the code BIRCH-2468 and correction3L→4L. All literal outputs contained the exact original Windows path; none of the old outputs did. Old escaping was intermittent, **not monotonically increasing**: cycle3 partially reduced the earlier doubling. The three literal results show the application transport fix worked for these public examples, not that every future model summary preserves literals.

Both forms lost the exact real newline between the requested code parts. Old outputs represented it as literal backslash-n; the literal branch described two-line rendering and subsequently omitted the two parts. It also added generic status/“No new facts” boilerplate. Do not treat these as perfect summaries or infer recovered facts from them. Original conversation turns remain available through explicit read paths. No stored summary is silently repaired.

Raw inputs/counts/outputs/usage/timings: `compaction-carry-cycle{1,2,3}-3ed5b4802c79ade6.json`; exact loaded fixtures in `../fixtures/compaction-carry-cycle{1,2,3}.json`. Per-case192 overrides the report's historical top-level256 default. All results have expected=null/pass=null and are reported as Observed, not semantic PASS. Observed generation times excluding model preparation ranged11.9–17.8s; this single-PC sample does not predict phone latency.
