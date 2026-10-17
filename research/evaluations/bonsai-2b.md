# Approved Bonsai2B comparison — Unit30, 2026-10-17

The manifest-pinned2B now has actual PC WebGPU load/generation evidence. **It does not repair the required contextual flow and was not adopted as the normal model.** Four-B remains selected, both normal workers unloaded, Downloads OFF. A2B catalog entry and its explicitly prepared local asset remain available.

## What changed

The explicit developer `?check=harness` route previously hardcoded4B. It now permits only manifest4B/2B, checks the selected model's existing local assets, loads that model and pins its revision in the report. Selection is locked during execution and clears old results when changed; fixture imports still cannot choose/install models, URLs or tools. No knowledge DB access or asset download exists in this route. Normal Input, planner policy, canonical storage, worker/runtime/reader pins and accepted UI are unchanged.

Review found a pre-existing cancellation gap: Stop during the awaited token count could start a new generation. A source-extracted deferred-count regression first failed with1 new generation after Stop; checking cancellation immediately after count makes it pass with0. This is a control test, not simulated model acceptance. No output/target was replaced with an expected answer.

The first eight actual comparisons ran product `a3e7e037d7c773b6` / `index-_qkdDN-w.js`, before the Stop fix. Final product `befd36343feda27d` / `index-CWFJeerC.js` includes that fix and supplied the later offline/Stop tests. Intermediate `279b45ffb86baa8f` was a build before selector markup completion; it was not a tested or adopted model-quality build. Both final product/protected-prototype builds pass; main chunks518.31kB/729.39kB retain prior size warnings.

## Assets and execution

Normal Settings Add model -> Bonsai2B -> explicit Prepare downloaded/verified429,183,456bytes. Manifest revision `683f7be2629342a50987627b40881e54761a2430`, PTQ1_0, SHA-256 `36061ad406df8a4903a6db005be350c50fabfaf717f9ef0acf4b76adcd9929fa`. Same WebML runtime revision `621e20782f208660f4f58283c2ce58430020f243` / SHA `00c1a72a962a84fee17000a6b1d18b24d75033e56d59996fc504b7c57cfc6488`. No other model/provider/server or runtime-license change. Normal selection was restored to4B and Downloads switched OFF before diagnostic execution.

`bonsai-2b-comparison.json` contains eight exact earlier PUBLIC4B inputs, same greedy/non-thinking2048 context and per-case budget, resetSession=true. Actual2B counts match those4B counts. Eight complete generations consumed about57.376s total generation time excluding load/warmup, about2.66–14.68s each. These scoped timings are not a standardized performance benchmark.

| Case | Actual2B observation | Required behavior / consequence |
| --- | --- | --- |
| raw-minimal | Gives code plus labeled before/after parts | Understands parts but violates two-lines-only output |
| old-transform | recall73/assistant | Correct small-case target; combined read/transform processing would still need its own actual validation |
| separate-crowded | answer82/assistant | Wrong action: ordinary answer dispatch ignores incidental historyIndex, so this does not dispatch original read |
| separate-first | answer with the old split query/body code | Wrong action; missing explicit original-first-user read |
| separate-capture | capture73/assistant | Required target/action present; no save was attempted in this diagnostic |
| separate-greeting | Two chat JSON objects | Production JSON parser rejects it; raw observational row is not a successful planner result |
| read-tool-operation-split | `{"action":"read"}` | Explicit split misclassified as read; literal operation would be bypassed |
| read-tool-operation-read | `{"action":"read"}` | Correct small-case read choice |

Every row remains `expected=null/pass=null/Observed`. No eight-pass claim, action/target repair, default-model switch or ordinary-context acceptance follows. Retained actual raw messages/counts/usage/timing/output: [eight-case report](bonsai-2b-a3e7e037d7c773b6.json). The verifier checks matching4B inputs/pins/counts and preserves the known JSON/operation failures: `node research/verify-bonsai-2b.mjs`. It does not run inference.

## Scoped offline and Stop evidence

After the first diagnostic tab was closed (worker terminated), a fresh final-build diagnostic tab was opened, its network emulated offline and document reloaded. Existing cached shell/assets loaded. Selected2B rehashed/reloaded/warmed up from local assets and answered a newly supplied public parcel-label question with `WILLOW-6942`. JSON answer parsing succeeded. Exact [fixture](../fixtures/bonsai-2b-offline.json) and [raw report](bonsai-2b-offline-befd36343feda27d.json) retained. This is actual new generation, not a fixed response or note DB query.

Still tab-offline, a fresh comparison completed raw-minimal, displayed old-transform, then explicit Stop reached Stopped and the later six cases did not execute. [Partial report](bonsai-2b-stop-befd36343feda27d.json) retains only the completed first result; stopped partial text was not accepted. The UI observation interval is not a measured GPU cancellation latency, and the report does not retain stopped token output. The deferred-count control test separately verifies no new generation is started after cancellation during counting.

Owned network emulation was reset; both diagnostic tabs closed. Normal settings were checked4B/Verified/Load and D1/Verified/Load, Downloads OFF. Server4180 still serves static files. No OS-wide network isolation, server shutdown, full browser-process restart, installed-PWA termination, physical Android/iPhone or ordinary2B knowledge/correction/media workflow was tested here.

## Data preservation and remaining work

Exports55 ->56 ->57 show81notes/3auxiliary settings/107runs/33originals/all84dialogue turns. Every prior record/turn/compaction is exact except append-only Models/Connection revisions for the explicit registration/preparation/update toggles. Exactly one new succeeded `model.prepare` receipt; no new knowledge note, original, dialogue turn or task execution. Wrapper `verify-2b-native.mjs` checks full records, not just counts; backups stay outside Git. Models are excluded from state brainpacks as before. No data reset or failed-turn erasure.

Fresh prototype191, baseline44, product2, Markdown4, check24, protected-runtime28, TypeScript and product/prototype builds pass. Reviewer found and reproduced the count/Stop gap; its fix has the failing-then-passing regression. None of these checks proves semantic quality. The ordinary4B subject-selection failure remains a core gate, alongside typed settings/tools edits, broader media/custom adapters, archive/storage and full-process/physical-device acceptance. No push or deployment.
