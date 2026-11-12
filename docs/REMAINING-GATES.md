## Current status · 2026-11-13

### Latest release and real-model verification · 2026-11-13

PR #64 merged as `b52d5e13f9159fc270c51d67413fc1c34abc5d11` after its exact
candidate passed the full quality workflow
[43243575108](https://github.com/Unjuno/babelshelf/actions/runs/43243575108).
The post-merge main workflow is
[43246327095](https://github.com/Unjuno/babelshelf/actions/runs/43246327095).
Public Site v353 serves build `430a24e0b828000a` /167 assets at
`https://babelshelf.com/`; the existing public audience is unchanged.

The public app completed real LFM3 1.7B QAD Q4_0 replies in a dedicated
persistent Windows Chrome 157 profile, with both browser networking and the
app's Online mode disabled. The Decision role remained unconfigured. Update
preserved the conversation, model and runtime; all 25 layers loaded on Intel
WebGPU. A short sky-writing request completed in 7.7 seconds of generation.
The previously failing Japanese rewrite returned `今日の空は青く澄んでいた。`
in 5.2 seconds /one model call. Neither send reloaded the model, and no
external requests were observed. A fresh 390px-wide public browser opened
the normal composer with no page-script errors or horizontal overflow.

Semantic current-answer rewrites now preserve their exact dialogue source
and use generation instead of the literal replacement classifier. The release
also distinguishes download from verification progress, retains a safe quota
explanation when Activity persistence fails, and briefly awaits the existing
worker when explicit preparation races first-launch activation. No implicit
registration, acquisition retry, model substitution or data reset was added.
Local checks passed 275 root tests, 1,994 prototype tests, nine built-asset
checks and the protected runtime check. Actual local Stop/Edit & resend and
missing-model draft retention also passed. See the dated real-model and v353
release entries in `docs/TEST-RESULTS.txt` for exact evidence.

Limits remain: the initial general question on v352 took 167.0 seconds of
generation, and the sky-writing response repeated its sentence on both local
and public candidates. Successful real replies establish PC execution;
general answer quality, sustained speed and physical iOS/Android acceptance
are not certified by this run.

### Previous integration and deployment · 2026-11-12

PR #62 merged as `c3dd64f6d9846a2d9197a8a66cffff6992a5d26d`. Missing or
corrupt app-shell caches now lead to a standalone Repair app screen instead
of a one-line dead end or an unbootable page. Repair/Update are explicit,
app-only downloads; user data and model-download preferences remain intact.
A verified update can replace an unavailable legacy worker without reloading
live drafts. All 22 specialized KnowledgeStore transaction paths now share
the bounded transaction-start reconnect policy, preserving CAS and refusing
to replay a write after it starts.

The exact PR candidate passed the full quality workflow
[43226135204](https://github.com/Unjuno/babelshelf/actions/runs/43226135204).
The integration workflow is
[43228368680](https://github.com/Unjuno/babelshelf/actions/runs/43228368680).
Local verification passed 275 root tests, 1,982 prototype tests, nine built
asset checks and three Chromium update/recovery scenarios. See the dated
startup-recovery entry in `docs/TEST-RESULTS.txt` for scope and evidence.

Public Site v352 serves build `f7a5a5fd3fd47685` /167 assets. Deployment
`appgdep_6af5c0b366fc81919a63c9abffab4085` succeeded with the existing public
audience and custom domain. At `https://babelshelf.com/`, a new isolated
Chromium context loaded the app, explicitly prepared its shell, then lost
only its disposable app caches. The repair screen remained usable, explained
offline recovery, and repaired the app in 9.2 seconds online. Its unsent draft
and Offline preference survived, as did a subsequent offline reload. No user
browser data or model assets were touched. The Site retains the immediate
predecessor's pinned assets and shell transport for existing clients.

The reported entrance regression is fixed and released. Prior schedule
validation/deletion/paused guidance and secondary header controls passed
built-app/CI checks. Model routing, deadlines and resident-model reuse have
code-level regression evidence. The later real-model check above verifies PC
inference on this public build; phone performance and physical iOS/Android
acceptance remain unverified.

### Previous integration and deployment · 2026-11-12

PR #60 merged as `222e9af263216004292465166f689d5e4ebe0c81`. It recovers
closed IndexedDB connections, explains unavailable chat decision-model setup
and stalled work, and improves schedule validation/deletion, paused-state
guidance, runtime check feedback and notification layering. Both the exact PR
candidate and merged main passed the full GitHub `Local PWA quality`
workflows [43211141048](https://github.com/Unjuno/babelshelf/actions/runs/43211141048)
and [43212839012](https://github.com/Unjuno/babelshelf/actions/runs/43212839012).

Public Site v351 serves app build `5e56fbffe17d2bfc` /167 assets. Site source
commit `403be964aa379e14043f51e2e6fed6cef6faf017`, saved version
`appgprj_6ad46c7eb3a88191b67b5fded25711d5~appgver_857ec8e7215c81919ca68c1f72891c06`,
and deployment `appgdep_6af5aa0c8d2c81919b11daafaf439763` succeeded while
preserving the public audience and `https://babelshelf.com/`. The public
manifest returned HTTP 200 with the expected build. The local Windows
Installed PWA test could not start its Chromium process; both complete GitHub
workflows passed that acceptance stage. No model/runtime was downloaded or
loaded, and no user browser data was cleared.

The product is not yet release-complete. Real-model loading and sustained
performance on target phones, iOS offline cold restart, cross-device data
recovery, and broader answer/tool quality acceptance remain open. PC/CI and
public-shell evidence are not device or model-runtime acceptance.

### Previous integration and deployment · 2026-11-11

PR #50 (`40bfed17`) merged as `0c31cf0a0351282e21701f522da7729b3cc47cdc`.
It adds a selectable local Granite Embedding 311M Search profile while keeping
the 97M profile and keyword-only mode available. Selecting a profile does not
download model files or rebuild the index. Existing settings are projected
through the current schema without rewriting stored preferences. Main passed
the full GitHub `Local PWA quality` workflow
[42952224733](https://github.com/Unjuno/babelshelf/actions/runs/42952224733).

Public Site v348 serves app build `47ab430e4c500b76` and bundle
`index-B8dAQvmm.js`; deployment `appgdep_6af3e3fdb3608191b4a18fc1f1b8e8a2`
succeeded. In the existing sidebar browser, Settings → Developer reported the
active worker build, and Settings → Models exposed Granite Embedding 311M
alongside 97M and keyword search. Connection mode was restored to Offline. No
311M model weights were downloaded or run. This verifies delivery, current
worker adoption and model-choice presentation, not embedding quality, device
performance, or physical-phone compatibility. The Site package excludes user
data and model weights.

### Previous integration · 2026-11-11

PR #44 (`a7fa2c0e`) merged as `53c832ca54f294ac6d71505683909c88492c399e`.
The JSON planner can call the explicitly enabled `web.search` tool when Online
mode and a search endpoint are available; tool execution rechecks the network
signal, and results stay attached to the active answer as citations. The exact
PR candidate and merged main revision passed the full local-quality workflow.

Public Site v345 served app build `3abccd8a21db2a9e` (166 assets). The existing
sidebar PWA adopted the matching worker and was returned to Offline mode. This
confirmed deployment/update behavior, not model inference or live search. No
model assets were downloaded during that release.

### Latest integration and model evidence · 2026-11-11

PR #42 was merged as `597bfd3d0bc746267ef0950cf51eb4c7648a0c9c` after its
exact candidate (`132acce9f2d03fef5aaa2cfa5082b7ccbec9ece0`) passed the full
Local PWA quality workflow [42916481371](https://github.com/Unjuno/babelshelf/actions/runs/42916481371).
It includes attempt-bound Web citations and a narrow planner presentation-leak
fallback that reuses completed retrieval evidence through the normal grounded
answer validator. Invalid planner text is not returned or saved.

Public Site v344 is deployed at `https://babelshelf.com`, serving app build
`0af7a307c3ec79d6` (166 verified assets). The existing sidebar PWA applied
that exact worker. Settings showed LFM3 IQ3_M 3-bit (869 MB) as a selectable
candidate; it was not selected, downloaded or run in the live browser.

Windows Chrome 157 PC validation loaded the pinned local LFM3 QAD Q4_0 GGUF,
then passed an offline cold browser restart, local answer, exact citation,
reviewed save, and multi-step Memory search/read/answer. The one Performance
sample reported 12.9 s model load, 84 output tokens in 7.39 s (11.37 tok/s;
runtime decode 13.44 tok/s), with runtime-reported 25/25 GPU layers. These are
single-run PC measurements; they do not establish sustained performance or
iPhone/Android execution. The next device gate remains a current-build iPhone
Home Screen run. Detailed scope and timings are in `TEST-RESULTS.txt`.

### Development branch and public release · 2026-11-11

The focused development branch `codex/rustxng-agent-search` is pushed at
`ec246b745b8b85ce2a48bd47d389593a1ec06b79`. GitHub's full quality workflow
[42907548465](https://github.com/Unjuno/babelshelf/actions/runs/42907548465)
passed. The change binds each Web citation to snapshots observed by the same
search attempt, avoiding attribution to stale fetched text when a URL/title is
repeated. See the matching dated entry in [TEST-RESULTS.txt](TEST-RESULTS.txt).

Public Site v343 serves app build `074714f8e10de7a4` with 166 verified app
assets. Deployment succeeded; the existing sidebar PWA refreshed and its
Developer panel reported that build as the active worker. Connection mode was
restored to Offline after this check. The release inherits the model catalog
and model sets recorded for v341 below; no model/runtime was downloaded or
loaded during v343 verification. This verifies source delivery and active
worker adoption, not model generation or iPhone compatibility/performance.

Post-deployment PC regressions verified the user-facing LFM3 IQ3_M add/select
path and that the Compact local set requires a separate explicit preparation
action (3 Playwright checks passed). Settings migration/recovery tests passed
44/44; model catalog, set and execution-route tests passed 30/30. These confirm
preservation of old settings bytes/history and registered adapter routing;
they do not verify actual IQ3_M inference, GPU placement or device fit.

The Send/agent orchestration regression group then passed 215/215 across the
read-only tool loop, coordinator, model execution, submission controller and
submission workflow. Coverage includes hiding Web search without an explicitly
available Online adapter, freezing the send-time tool/profile snapshot,
distinguishing profile and receipt-capacity exhaustion, retaining useful
partial evidence, stopping late model results, and keeping generated note/save
actions behind review. These are controlled PC regressions, not a live-model
search-and-save quality result.

PR #39's v341 product tree came from merge commit
`0e2be9077f805c173db6db0009f345a69353cd2c`. Its exact candidate passed the
full `Local PWA quality` workflow
[42875405317](https://github.com/Unjuno/babelshelf/actions/runs/42875405317).
Settings → Models lists LFM3 Q4_0, community IQ3_M 3-bit, Q8_0, and model sets
that include local Search (Compact media, Text + image + audio Q8, and Full
local). The selected default LFM3 text-only set remains Search-free; Initial
setup estimated its model plus runtime at 1,077.2 MB. No model/runtime was
downloaded or loaded. This verifies selectable catalog and preparation-plan
metadata, not model execution or device fit.

The supplied iPhone report was created on 2026-11-04 by older build
`bae57d2542fed742` in a Safari tab (`standalone:false`). Its selected model was
LFM3 QAD Q4_0 with a saved 262,144-token context; the run stopped during model
load. That report does not include the effective test context and cannot
establish whether the phone is defective or whether the current build fails.
Current code bounds an unloaded LFM3 Developer test to 8,192 tokens, leaves the
saved model setting unchanged, and reports configured and effective contexts
separately. The load-feedback UI identifies unavailable runtime percentages,
elapsed time, navigation-safe progress and Stop; it cannot invent an exact
percentage when Wllama emits no progress. The remaining iPhone gate is one
current-build Home Screen PWA run of the selected model. A WebGPU adapter probe
is not proof the model ran on that adapter or fits memory.

The Developer test limit is enforced for custom LFM3 registrations inside the
Worker too; it uses the lower of the selected model's configured context and
2K/4K/8K test context. PC regressions pass (1,948 prototype tests); the
physical iPhone runtime gate is still open.

### Previously verified implementation milestones · 2026-11-10

The development branch's Activity privacy projection now retains only
calculator expressions accepted unchanged by the closed arithmetic parser;
other arbitrary text remains a byte-count summary. This keeps the offline
calculator receipt usable without reopening general prompt/query retention.
Local targeted and full regressions passed, and GitHub Quality run
[42805551555](https://github.com/Unjuno/babelshelf/actions/runs/42805551555)
passed every gate on PR #31. PR #32 then corrected browser dependency setup
timeouts in CI and was merged with documentation-only changes. Both its full
PR run [42812616863](https://github.com/Unjuno/babelshelf/actions/runs/42812616863)
and post-merge main run
[42814319175](https://github.com/Unjuno/babelshelf/actions/runs/42814319175)
passed every gate. GitHub `main` is now `b748a7ff`. The public Site remains
v336 with app build `1effe00c90b651b8` /166 verified assets, whose product code
is identical to the merged main code; PR #32 changed only docs and CI timing.
Detailed evidence is in [TEST-RESULTS.txt](TEST-RESULTS.txt) and
[SITES-DEPLOYMENT.md](SITES-DEPLOYMENT.md).

The title-bound water comparison guard now checks explicit strict and
non-strict relations instead of reducing every comparison to a greater/not-
greater boolean. It covers a narrow set of English and Japanese comparative
forms, their supported negations, and equal amounts. This fixes cases such as
17 L `does not contain more than` 29 L and prevents 17 L from being described
as `less than` an equal 17 L. It remains a lexical contradiction check, not
general semantic verification. Local answer-consistency, complete prototype,
root, static, production acceptance, and full GitHub quality workflow passed;
no model or Memory data was read or changed. Current iPhone inference and
model quality remain unverified.

Decision routing now sends the exact current request to the selected local
classifier as before, but its persisted Activity receipt stores only the
UTF-8 input size, attachment count, prior-context flag, finite routing label,
confidence, device route, token count and elapsed time. It omits the question,
attachment names/statuses and full probability distribution. This fixes a
local audit-retention leak without changing model routing. Historical Activity
records are not rewritten; future Decision receipts use the bounded projection.

PR #31 integrates the receipt projection and Activity privacy fixes. Public
v336 was built from that main state and delivered to `https://babelshelf.com`.
The existing sidebar PWA applied bundle `index-DMIP4Ijk.js`; Offline mode was
restored. No model was added, downloaded, loaded or run. Existing model assets,
runtime sources and QA browser data remain preserved.

The first PR #30 CI run timed out while waiting for the `beforeunload` dialog
after an attachment was shown. The component registered its guard in a passive
effect, which can run after the committed UI is visible. Registration now runs
in the commit phase, closing that lifecycle window. Root
tests (271/271), prototype tests (1,942/1,942), static checks, app acceptance
(9/9), production build (166 verified assets), and built editor acceptance
(28/28) passed locally; the targeted regression passed three consecutive
runs. GitHub workflow [42789509707](https://github.com/Unjuno/babelshelf/actions/runs/42789509707)
passed on rerun after an initial one-off timeout in the same browser test.

The persistent Developer operation toast now keeps elapsed time visible after
navigation, exposes Copy snapshot during app/model checks, and exposes Stop
test during model execution through the existing abort/report path. Focused
Developer UI coverage passed 35/35, diagnostic logic passed 60/60,
`npm run check` passed, and `npm run build:app` produced the deployed build.
This improves recoverability and report access; it does not explain or reduce
the iPhone's reported 18m23s model load. Physical-device timing remains open.

Sidebar browser check after v335: the live Models page showed LFM3 QAD Q4_0
selected but `Not prepared`; Decision, Speech, Image text, and Image
understanding were `Not configured`; semantic Search was `Off`. The Add model
dialog showed LFM3 IQ3_M as `3-bit IQ3_M · Community · 869 MB`, with the
approximately 3.66 bits/weight note, GPU preferred/CPU fallback, and
not-tested-on-this-device status. The Decision catalog showed Open D1 600M and
a custom D1 import path. No model was added or prepared; optional role weights
remain explicit downloads. This establishes catalog visibility only, not
quality or device fit.

The deployed text catalog exposes `LFM3 · 1.7B · 3-bit IQ3_M · Community · 869 MB`,
with the `~3.66 bits/weight` note and `not tested on this device` status. It is
addable but remains unprepared and untested; no model weights were downloaded
or run during release verification. iPhone compatibility and generation
performance remain unverified. The PWA initially retained its old worker after
the host deployment; using its explicit Update action applied the new worker.

The current product catalog exposes Text, Decision, Speech, OCR, Vision and
optional semantic Search roles. LFM3 IQ3_M is a built-in, selection-only
community candidate at 869 MB; it has no real-model load/generation acceptance
and must not be described as phone-compatible. Existing text/decision/model-set
selectors and separate model role catalogs are present in source. Their code
presence alone does not prove the current browser has refreshed its app shell.

Semantic Search is an optional local embedding role with explicit
asset/runtime preparation, revision-keyed derived storage, and deterministic
lexical fallback. PR #15 connected the selected, loaded Search runtime to the
normal Send/agent path before its registered `memory.search`. Its coordinator
integration regression retrieves a semantic hit, reads the current note
revision and checks exact citation evidence. Focused local results: 77/77
coordinator tests, 65/65 semantic/settings/model-set tests, and `npm run check`
pass; PR quality passed and the app is included in public Site v331. These are
controlled integration and delivery checks, not evidence that Granite was
used on a physical phone, that semantic ranking over indexed canonical Memory
works in a live turn, or that the normal agent produces a correctly cited
answer from those ranked results. Those product-flow/device gates remain open.

2026-11-10 public app smoke: the sidebar browser initially ran old bundle
`index-9n0tia0c.js`; the Site served build `46dc9d2ee209691a`. The app's
Online refresh applied `index-BaMBGDee.js` and exposed the Search model setup.
The app-owned flow downloaded and verified its 27.4 MB runtime and 123 MB
Granite int8 model, then loaded the model Worker. “Test Search” ranked the
matching synthetic passage first. After switching the app to Offline, the
same already-loaded model passed the smoke test again. Settings were restored
to the original LFM3 model set and Offline mode; Search was turned off, and a
subsequent local-file check reported “Files verified.” No canonical Memory
notes were indexed or changed. This is real browser/runtime inference evidence,
not an offline cold load, canonical-Memory search, agent answer/citation,
phone-fit, or sustained-performance result.

The current text-model load path has a five-minute no-progress deadline and a
30-minute absolute deadline, retires its inference Worker on timeout, and
ignores late replies. These prevent an indefinite app-level wait when the
runtime stops reporting progress; they do not make a suspended iOS page execute
or prove the model fits. The supplied iPhone reports are from 2026-11-04 build
`bae57d2542fed742` in Safari tabs (`standalone:false`): one performance run was
stopped during model load after 18m, and later readiness runs did not generate.
They do not establish current-build LFM3 failure or success. A targeted current
installed-PWA run remains required for iPhone behavior.

Historical store follow-up (before the public app smoke above): the app-owned pinned asset store now downloads any
manifest asset larger than 16 MiB in durable OPFS HTTP ranges, rather than
limiting resumable acquisition to `.gguf` files. The interrupted-range
regression now uses a large ONNX asset and confirms retry requests only the
uncommitted final bytes. This is store-level fault-injection coverage; it does
not prove CDN range behavior under interruption or indexed-Memory integration.

2026-11-10 adapter preflight: `semantic-embedding-worker.ts` and its client
use the exact pinned Granite package, verified OPFS reads, local-only
Transformers.js/ONNX WASM execution, CLS pooling, L2 normalization, bounded
8-text batches, a five-minute model-load deadline with retryable Worker
termination, and progress during asset verification. `semantic-search-runtime.ts`
coordinates explicit runtime/model preparation with revision-keyed derived
indexing and live-source citation rebinding. Prototype build, app build
(166 verified assets), `npm run check`, all 1,931 prototype tests and product
acceptance (9/9) passed at that preflight checkpoint. The public app smoke above
later downloaded and loaded the model in its Worker, while canonical Memory
indexing and normal agent answer/citation remain unverified.

### 2026-11-10 · reconcile model roles before expanding the catalog

At this earlier checkpoint, GitHub branch `codex/ui-design-handoff` was at
`2c57bcf`; the retained untracked QA directories and benchmark artifacts were
left untouched. The preceding release already includes the
LFM3 IQ3_M model, its selection-only compact media set, and discoverable Text,
Decision, Speech, OCR and Vision model catalogs. IQ3_M is pinned to a community
GGUF revision and remains an unverified runtime/device candidate; selection or
download metadata is not proof that it loads or generates on a phone.

`memory.search` remains a deterministic local tool rather than a model slot.
PR #15 added an optional, separately prepared embedding route for ranking
search results, while retaining deterministic search as the offline and
not-prepared fallback. Stored vectors are derived data keyed to exact note and
embedding-model revisions; they can be rebuilt or discarded without changing
original Memory files. Search hits do not establish citations: the host reads
and binds the current source revision, then applies exact source-reference
validation.

Transformers.js supports feature-extraction models. A concrete compact
candidate is [Granite Embedding 97M Multilingual R2 ONNX](https://huggingface.co/onnx-community/granite-embedding-97m-multilingual-r2-ONNX): its card lists 97M parameters, 384-dimensional output, Apache-2.0, 52 explicitly enhanced languages including Japanese, and describes 200+ language pretraining. The card's retrieval scores and throughput are upstream benchmark claims, not BabelShelf or target-device measurements. At inspected revision
`536a9f241cb3f02a9c5995a1e708c784bd274859`, the selected `onnx/model_int8.onnx` is 97,858,099 bytes (LFS SHA-256 `704c1ebca5fbb7cd83ced41827658ac4c9990c64f7f2874d22b78044e5022e22`) and `tokenizer.json` is 25,301,671 bytes (LFS SHA-256 `51947676cae1f991fa51c6b9a24e14ee5460e5f0b9f692f13bb3159829d1592a`); adding config and tokenizer metadata gives an approximately 123 MB package. The repository contains other larger variants, so preparation must pin only the selected files rather than acquire the full repository.

PC preflight before the product adapter used the exact revision/int8 file and the Transformers.js tokenizer. Direct ONNX Runtime Node CPU and ONNX Runtime Web WASM CPU sessions both loaded the verified file bytes and produced 384-dimensional CLS-pooled, normalized embeddings; the same small Japanese query ranked its related passage above an unrelated passage (cosines 0.916/0.737 and 0.913/0.740 respectively). One run including tokenizer/session setup took 1.847 s for Node CPU and 1.938 s for ONNX Runtime Web WASM. This is a smoke sample, not a retrieval-quality benchmark. Transformers.js `pipeline('feature-extraction', ... device:'cpu')` on Node still fails when ONNX Runtime Node loads the cached model by path, even though that file exists and its SHA-256 matches; direct session-from-bytes succeeds. Since the PWA uses ONNX Runtime Web, the direct WASM pass reduces concern about the candidate graph but does not validate the app's browser Worker, Vite packaging, GPU provider, cancellation, cache or indexing path. Model acquisition remains explicit and resumable. The selector, model preparation, derived index and semantic ranking were added after this preflight; their current evidence and open real-model/device gates are listed above.

2026-11-10 implementation preflight (historical stage before PR #15): added `semantic-search-core.ts` as a small, runtime-independent boundary. It creates exact UTF-16 source ranges with bounded overlap and binds proposed semantic hits only when note ID, current revision, range and exact quoted text match the current canonical note; result metadata comes from that note and results are capped. The focused four-case suite and full prototype suite (1,909/1,909 before the added configuration case) passed, `npm run check` passed, and the prototype TypeScript/Vite/Sites build passed with the protected mobile runtime integrity check. At that stage the model preparation UI, browser inference worker, derived embedding index, semantic ranking and Search role were absent. PR #15 subsequently connected these pieces to normal agent `memory.search`; see the current status at the top of this file. Do not treat this earlier snapshot as the current feature state.

Citation-boundary follow-up (pre-product integration): `bindSemanticHits` was changed to admit only canonical records whose state is exactly `active`. A regression reproduced that a higher-ranked `withdrawn` note could otherwise win semantic retrieval; withdrawn and state-unknown records are now excluded before citation binding. This protects the canonical-source boundary but does not establish semantic relevance.

Semantic ranking preflight (before product integration): `rankSemanticVectors` normalizes array and Float32 query/candidate vectors, ranks by cosine similarity, filters stale embedding-model revisions and malformed vectors, and caps candidates. The focused semantic suite passed 6/6 and the full prototype suite passed 1,913/1,913 at that checkpoint.

Derived-index storage preflight (before product integration): added a separate versioned IndexedDB for vectors keyed by model revision and note revision. Stored vectors are normalized to Float32, using half the payload size of Float64 numbers. Per-note replacement is atomic, stale model data can be removed, and malformed records fail before the existing snapshot can be replaced. Tests cover revision replacement, model isolation, cancellation before write, Float32 persistence, and unchanged canonical Memory data (3/3). The combined prototype suite passed 1,916/1,916; `npm run check`, protected-runtime integrity (28 files), and the prototype production build passed.

Search-role schema preflight on `codex/semantic-search-foundation` (before PR #15): the code change added empty `searchModel`/`searchLibrary` fields through an in-memory schema migration and extended saved model-set records. The root PWA connection-policy reader accepted schema 6 while still failing closed on unknown schemas and malformed values. Migration/model-set/settings-correction tests passed (74/74), root tests passed (271/271), the prototype suite passed (1,911/1,911), `npm run check` passed, the production app packaged 163 verified assets, and product acceptance passed (9/9). At that historical stage this was configuration only and publication was deferred; PR #15 later completed the product wiring. Actual model inference and product-level retrieval remain unverified.

Semantic-search orchestration preflight on `codex/semantic-search-foundation` (2026-11-10): `semantic-search-service.ts` now batches caller-provided embeddings, atomically replaces per-note derived vectors only after successful embedding, prunes derived vectors for deleted/withdrawn/protected/system notes, and reloads the current source list after query embedding before binding ranked hits. New derived entries store ranges and vectors, not duplicate passage text; citations are reconstructed from current Memory. Indexing preflights its chunk budget before embedding and materializes text for one note at a time. Service/store/core tests pass (16/16), the complete prototype suite passes (1,924/1,924), `npm run check`, TypeScript and prototype production builds pass.

Embedding-package pin preflight (2026-11-10; historical stage before the app adapter): `semantic-embedding-manifest.json` freezes the inspected Granite multilingual revision's config, tokenizer, and int8 ONNX files, with exact byte counts and SHA-256 values. A runtime guard verifies ModernBERT, CLS pooling, and 384-dimensional output metadata. The package totals 123,174,716 bytes (about 123 MB decimal); this is transfer size only, not memory use or device fit. Manifest/config tests passed (2/2). The app-owned asset/runtime adapter and Search settings were added after this snapshot; actual app asset acquisition and inference remain unverified.

Historical preflight notes above describe stages before the PR #15 integration. Current code now registers the embedding adapter, exposes model/runtime preparation and connects prepared semantic retrieval to normal `memory.search`; do not use those older “not available” statements as current status. Still unverified: actual app-owned Granite asset acquisition and inference, background/explicit indexing behavior in a live product flow, semantic retrieval and citation in an installed browser, and physical-device memory/performance. The optional role should remain unprepared by default until those flows are accepted.

After that reconciliation, the IQ3_M selection path was rechecked on the
current branch: 80 focused model/catalog/runtime unit cases passed, and 17
Settings/model-discovery browser cases passed, including selecting the compact
media set without preparing weights. `npm run check`, the 163-asset production
package (`830a89c6832b09e4`), and app acceptance (9/9) also passed. The app
package matches the one already recorded for public Site v328, so this check
found no new application code to deploy. These are Windows/Chromium checks;
they do not establish model loading, generation, or runtime speed on iPhone.
At that checkpoint the branch was at `fc14995`; the next implementation task
remained the optional Search adapter described above, not another model
catalog entry.

### 2026-11-10 · publish and verify compact IQ3_M model set

The model-set sheet previously omitted the `Compact local set` group even though
the registered LFM3 IQ3_M media preset was available. Added the group to the
rendered model-set list and covered both its visibility and selection-only
behavior. Local regression checks passed: model-set unit tests 13/13, focused
browser checks 2/2, `npm run check`, app packaging (build
`830a89c6832b09e4`, 163 assets), and app acceptance 9/9. GitHub clean-checkout
quality workflow [42658884497](https://github.com/Unjuno/babelshelf/actions/runs/42658884497)
passed all stages. Public Site v328 was deployed from Site source commit
`27fa1d32f5870ca2165303824611f7e63406112b`, carrying app source commit
`0c7e392dddd5d3d3374cc20fdb138a084460a1ea`. In the sidebar browser, Developer
reported active worker build `830a89c6832b09e4` / bundle `index-Cej1lY_B.js`,
and the model-set sheet displayed the Compact local set with LFM3 IQ3_M,
Whisper tiny, Tesseract 7, and LFM2.5-VL 450M. The selected QAD Q4_0 model
remained selected; the set was not applied and no model/runtime assets were
downloaded. The in-app refresh action remained busy until a normal reload; that
reload applied the new worker. This observation is recorded for follow-up if it
reproduces, not treated as a proven refresh-path regression.

### 2026-11-10 · publish observed GPU layer placement (v327)

App build `d18ac58c757bff40` was deployed as Site v327 from source commit
`4a4df7ab001773e3c93c2751e98264f0ff0f0e5c` after GitHub quality workflow
[42655817920](https://github.com/Unjuno/babelshelf/actions/runs/42655817920)
passed. The sidebar browser applied and verified that build, then restored
Offline mode. GPU layer placement remains runtime-log evidence, not a model-load
percentage or proof of device performance.

### 2026-11-10 · surface observed GPU layer placement during model load

Pinned Wllama 3.12.0 does not define a model-load percentage callback in
`LoadModelParams`; its documented byte progress applies to download APIs. The
app previously showed only “Loading model” after file verification. The LFM
adapter now forwards its existing selected-runtime log `load_tensors: offloaded
N/T layers to GPU` while `loadModel` is pending. The UI shows “GPU layer
placement · N/T” and keeps the overall bar indeterminate. This is runtime log
evidence of layer placement, not a completion percentage, total load progress or
proof that every device uses the same GPU. CPU routes and runtime builds that do
not emit this log remain indeterminate.

The focused LFM adapter suite passed 41/41; large-context Developer UI passed
1/1; product acceptance passed 9/9; `npm run check` passed; build
`d18ac58c757bff40` verified 163 assets. These checks validate log forwarding and
packaging, not real-model timing or iPhone/Android GPU execution. Device/model
performance evidence remains open.

### 2026-11-10 · publish the current app build and verify the installed update path

The exact app source at `98f2b669f6653b5da741f01771df4506368c15d3` passed clean-checkout
GitHub quality workflow [42646089873](https://github.com/Unjuno/babelshelf/actions/runs/42646089873).
Site v325 served a stale prior build despite the newer release source. Updated the
Site Worker cache policy for mutable shell routes and deployed Site v326 from
source commit `070dadfa9bb88e2c4953432b7d7f7ce3b6043d9e`, carrying app build
`50a5094377aebc7a` and 163 assets. Both public domains returned HTTP 200 and the
expected build manifest; the public JavaScript bundle SHA-256 matched the local
build. In the sidebar browser, the app Update action applied the new worker and
bundle; after switching back to Offline, Developer still reported active worker
`50a5094377aebc7a` and page bundle `index-B9_FUZkj.js`.

The Worker requests `no-store` on mutable shell routes, while the public edge
normalized the observed response to `Cache-Control: public, must-revalidate,
max-age=0` and reported `CF-Cache-Status: HIT`. The update path worked in this
run; the edge’s effective cache behavior remains a delivery check to retain.
The model catalog shows LFM3 IQ3_M as an 869 MB community candidate that must be
added before it appears in the active Text selector; it remains untested on this
device. Open d1 and LFM2.5-VL are discoverable; OCR is Tesseract-only, and there
is no separate Search-text model role (local retrieval is deterministic).
No model assets were downloaded, Memory data was not changed, Offline mode was
restored, and physical-device inference remains unverified.

The supplied iPhone Performance report used a configured 262,144-token context;
its model test was stopped during `model-load`, and the accompanying screen
showed 18m23s elapsed without runtime progress. This proves a long, unreported
load was experienced at that setting; it does not distinguish slow context
initialization, device memory pressure, runtime behavior or user Stop. Local
preflight passed 42 LFM3-adapter/context cases and one browser test confirming
the large-context warning and explicit confirmation. The adapter suite proves
selected context forwarding at 16K/32K only, not successful model load or 256K
fit. A single same-device 16K Performance run is the targeted evidence needed
to determine whether the 256K setting materially contributes.

### 2026-11-10 · keep grounded citation records typed through finalization

The grounded-answer adapter previously represented parsed source references as
`any[]` and cast them again at its return boundary. It now keeps the host's
`SourceRef[]` contract through normal parsing, citation repair, source freshness
checks and result construction. The verbatim recovery parser treats model JSON
as `unknown` and validates object shape and answer/status fields before binding
the returned phrase to an exact excerpt. This is a type/data-shape integrity
improvement; it does not prove that a cited passage semantically entails every
claim. The existing narrow consistency guards and their explicit limits remain.
Focused answer-consistency, citation-presentation, conversation and verbatim
recovery suites passed 249/249; `npm run check`, the 163-asset app build
(`50a5094377aebc7a`), product acceptance 9/9 and `git diff --check` passed.
No Memory data or model files were read or changed. Cross-device inference
remains open.

### 2026-11-10 · expose Decision model discovery and reconcile the deployed build

The Decision model catalog was only reachable inside the collapsed “More” section,
while the Text, OCR and Vision catalogs had visible entry points. The standard
Decision catalog action now sits beside its role heading; adding a custom ONNX
model and file-management details remain in More. The public app’s current active
worker is build `e17e92a9db1a5984`, and the Site release source records GitHub
commit `ff152bf95499c44c2bddc8bef910f255e1235c37` with that same build. This
reconciles the public shell with the latest pre-change GitHub commit; it was not
an outdated deployment. The current browser profile has LFM3 Q4 selected but
neither its weights nor runtime prepared. IQ3_M is listed as a community
candidate and explicitly untested on this device; model listing is not runtime
acceptance. Role/catalog regressions passed 71/71 Node tests and 2/2 browser tests;
`npm run check` passed; local app build `1e9173b97ab3cd7e` verified 163 assets.
The exact app commit `a2f167a0974ed8c11193842ba4efa7348dbb1883` passed all
stages of clean-checkout GitHub quality workflow
[42642015536](https://github.com/Unjuno/babelshelf/actions/runs/42642015536).
Public Site v324 was then deployed from that app commit. A read-only request to
`https://babelshelf.com/build.json` returned HTTP 200, build
`1e9173b97ab3cd7e`, and 163 assets. The sidebar browser observation above was
the pre-deployment baseline; it was not reloaded after deployment. No model was
downloaded, no Memory content was changed, and no physical-device inference was
tested.

### 2026-11-09 · hard-stop model-count and worker-session invalidation

The current GitHub head merged the verified Worker termination guard. Its latest
GitHub quality workflow passed all stages on `ff152bf95499c44c2bddc8bef910f255e1235c37`
([run 42633357328](https://github.com/Unjuno/babelshelf/actions/runs/42633357328)).
The Decision-catalog visibility change above is now covered by its own passing
CI run and is included in public Site v324. The unresolved product gate is
model/runtime preparation and real inference on supported devices; listing a
catalog item or serving a build does not establish that gate.

### 2026-11-04 · make LFM3 runtime preparation visible on its own

Models now shows the selected text engine's runtime state and a separate
runtime-only Prepare / Check action, with Stop while it runs. This uses the
existing pinned runtime cache operation and does not fetch model weights. The
Initial setup flow remains available for users who want the selected set
prepared together. The LFM3 runtime is 27,562,631 bytes across four optional,
hash-pinned assets; the selected Q4 model file is about 1.05 GB. Production
acceptance confirms the runtime worker is included in the app shell while the
runtime itself stays on demand and its retry chunks reassemble to the pinned
asset. Settings browser coverage passed 12/12; full prototype tests passed
1,883/1,883; root check passed; production app build verified 165 assets; app
acceptance passed 9/9. This validates preparation UX and packaging, not a fresh
LFM3 generation or iPhone runtime success. The supplied iPhone report stopped
before model-weight preparation and generation.

### 2026-11-04 · verify a real model load across an app-screen change

On the public Windows/Chrome PWA (active build `76f88c05662d96e0`), the
already-prepared Bonsai 2 · 4B model was loaded from Models. While the UI
reported `Compiling kernels (warmup)`, navigation to Memory completed and the
global operation indicator and Stop action remained visible. After returning
to Models, the model reported `Loaded · GPU unconfirmed`. It was then unloaded
to restore the prior in-memory state. No model was downloaded, no model
selection or preference changed, and no Memory content was created or edited.
This is one observed PC run and confirms model-load continuity across SPA
navigation; `GPU unconfirmed` does not prove GPU execution. Generation or
tool execution continuing across screen navigation, browser reload, app close,
and physical iOS behavior remain separate, unverified gates.

### 2026-11-04 · distinguish LFM3 model-load time from runtime setup

The supplied screenshot shows LFM3 context `256K` selected. The application
default and the fresh Q4/Q8 manifests are `8K`; the selected context is passed
through the LFM3 manifest as `n_ctx` to Wllama `loadModel`. The settings UI
already warns that 256K is the model maximum, uses more memory, and can make
phone loading slower or fail. This makes the selected context a plausible
load-time contributor, but the screenshot contains no device memory, elapsed
stage breakdown or load metrics that establish it as the cause of a 30-minute
load.

The pinned Wllama `loadModel` API emits no incremental model-load progress;
the adapter reports the phase name only. The current UI therefore shows an
indeterminate bar, elapsed time and Stop instead of inventing a percentage.
Stop routes through `TextEngineRouter.abort`, which retires the selected
inference Worker; local engine-loss and adapter cancellation tests cover the
contract, but this has not been confirmed on the reported iPhone. The next
useful device comparison is one cold 8K load with its phase/timing report,
after current build and installed Home Screen status are confirmed. Do not
interpret the earlier `runtime-setup` report as a model-load measurement.

### 2026-11-04 · keep installed-PWA diagnostics acceptance aligned

The offline-process acceptance opened the Developer screen but did not open
its collapsed Test options section. It also assumed the browser-tab default
(`App & storage`) inside the installed PWA, whose default is `Quick`. The
acceptance now expands the section and checks the mode-appropriate action.
Local `npm run test:quality:offline` and `npm run test:quality:installed-pwa`
passed; clean-checkout GitHub Actions [41777291794](https://github.com/Unjuno/babelshelf/actions/runs/41777291794)
passed all stages on `1687f0e`. This confirms the PC browser and installed-PWA
acceptance script path, not physical iOS offline behavior or model execution.

### 2026-11-04 · fail closed on incomplete current settings

Preference parsing previously supplied known legacy defaults even when a
current schema-v3 record was missing the field. A partially written current
record could therefore appear valid and allow a subsequent save to normalize
away the damaged shape. Legacy projection now runs only for older schemas;
current-schema omissions are invalid and remain untouched until the existing
explicit, history-preserving recovery action. The regression covers Models,
Appearance, Connection, and Harness read and save paths. The browser migration
fixture now explicitly declares schema 1 instead of carrying schema 3 while
omitting current fields. Settings UI acceptance passed 19/19 locally after
correcting the fixture; the prior CI failure was this mislabeled fixture, not
the current-schema rejection. Clean-checkout GitHub Actions
[41749613966](https://github.com/Unjuno/babelshelf/actions/runs/41749613966)
then passed every stage on `b754d25`, including core/build, tool/MCP, device,
settings, editorial/iOS handoff, and offline/installed-PWA acceptance. This
confirms the migration guard and correctly labeled legacy fixture in CI; it
does not prove recovery behavior against a real user's existing database.

### 2026-11-04 · identify saved diagnostics from another app build

Developer previously showed a report's build ID but did not compare it with
the active service-worker build. Old device results could therefore look like
current-build evidence. The report summary now says when the saved report came
from a different app build and directs the user to rerun the check. A UI
regression covers the mismatch; the complete diagnostic UI suite passed
34/34, `npm run check` passed, and the product build completed with 165
verified assets. This is an explicit freshness cue, not a claim that the
current build behaves the same on that physical device. Clean-checkout CI
[41752323522](https://github.com/Unjuno/babelshelf/actions/runs/41752323522)
passed all stages on `fcf56c1`; system dependency install took 33 seconds and
pinned browser install 13 seconds in this run. This single fast run does not
show that the previously observed APT delay cannot recur.

### 2026-11-04 · keep complete graphemes in source excerpts

The core knowledge chunker uses UTF-16 offsets so citations map directly to
JavaScript string ranges. A boundary at code unit 700 could split an emoji's
surrogate pair, leaving an invalid half in one search excerpt and the other
half in the next. Chunk boundaries now use grapheme segmentation when the
runtime supports it, keeping combining marks and joined emoji intact; the
fallback still protects surrogate pairs. An oversized single grapheme is kept
whole to guarantee progress. Source text and UTF-16 citation offsets remain
unchanged. Regression checks cover exact slicing, search citations, combining
marks, and family emoji.
The regression suite passed 264/264, prototype tests passed 1,875/1,875,
static checks passed, and the rebuilt shell verified 165 assets with app
acceptance 8/8.

### 2026-11-04 · let planner replies use model/context output capacity

The final planner generation had hidden product ceilings: 2,048 tokens for the
JSON planner path and 3,072 tokens when a native-tool model omitted a separate
output limit. Those were generation maxima, not a guarantee that every reply
would be that long, but they could stop an otherwise continuing answer while
model context remained. Final planner output now uses the remaining selected
context up to the registered model output limit, then applies the existing
reply-style policy. The smaller 2,048-token planning reserve remains only in
preflight/history-compaction decisions, where it protects room for tool
planning without forcing history to be discarded to reserve the entire reply
window. Conversation tests passed 233/233, grounded-answer/reply-style and
planner-evidence tests passed 21/21, static checks passed, and the production
shell built with 165 verified assets; app acceptance passed 8/8. This removes a
harness-side cap; it does not guarantee the model will produce longer answers
or prove quality on every runtime. The first clean CI run exposed one activity
assertion pinned to the old 2,048-token maximum; it now derives the expected
limit from the 32,000-token test context minus its 123-token prompt. Focused
agent-coordinator/conversation tests passed 308/308, and the full local
prototype suite, root suite and static check passed after that correction.
Clean-checkout CI [41741611062](https://github.com/Unjuno/babelshelf/actions/runs/41741611062)
passed every stage in 9m54s on commit `855f5c7`.

### Live deployment provenance check

The supplied iPhone failure report is from public app build
`48777327b2d5c402` (historical Site v308), while the current public endpoint
now serves build `2f47f2bc1bca02d3` (Sites v315, deployment status `succeeded`).
The current Sites record's source SHA is `f7688865dfa6d828ac24a220da88efa5d754dcf0`,
which does not resolve in this GitHub repository. This confirms the reported
29-minute failure belongs to an older public build and that the currently live
artifact's source provenance is not yet tied to the checked-out branch. The
live manifest's `Prototype-D1ijNXYd.js` entry (733,285 bytes,
`fe99385b0b5e61fac25f051a06f3ad4f0b47e1f37b513b2fe4f4d75fc1fe387d`) matched
the fetched artifact's byte count and SHA-256. That bundle contains the maximum
runtime-preparation deadline, idle timeout, `visibilitychange` resume check,
and `runtime-timeout` category. This verifies the code is in the served
artifact, not that it runs correctly on the reported iPhone. No product code or
deployment was changed during this provenance check. See
[SITES-DEPLOYMENT.md](SITES-DEPLOYMENT.md) for the Sites version and artifact
metadata.

### 2026-11-04 · diagnose the supplied iPhone Full cycle report

The supplied report is from the older public build `48777327b2d5c402`, not the
currently served v315 build. It records a Full cycle failure in `runtime-setup`
after 1,764,321 ms, with `assetState: not-run` and `filesPresent: false`. This
run therefore did not measure model download, model load, generation, or GPU
execution; it stopped before model asset preparation. Its `standalone: false`
signal means it ran in a browser tab, and it contains no evidence that Airplane
Mode or force-close occurred. Current code already bounds runtime preparation,
cancels it on timeout, and rejects late worker replies; the public v315 bundle
contains that implementation. Focused runtime/device regressions passed 25/25
locally, covering timeout, cancellation, resume deadlines, stable error
classification, and the rule that a timeout does not trigger an automatic
second download. No source fix is justified by this old report alone. A current
Home Screen Full cycle is still needed to validate the runtime behavior on this
specific iPhone and, if it gets past runtime setup, model acquisition and
generation.

### 2026-11-04 · validate internal details on the plain-dialogue route

An existing public-page conversation displayed tool syntax and source
identifiers in an older retained answer. That historical turn is not proof of
current-model behavior, but inspection found that the ordinary `mode: chat`
path returned generated prose without the internal-implementation validator
used by grounded and native-agent answers. Plain dialogue now checks the
completed answer, clears a flagged streaming preview, retries once against the
same dialogue without the rejected answer, and fails closed if the rewrite
still leaks. The regression failed before the fix and passes after it; it also
checks preview clearing and the one-retry limit. Conversation tests passed
234/234, the full prototype suite passed 1,877/1,877, root tests passed
264/264, static checks passed, and the production shell built with 165 verified
assets (`56675ea2af9c9039`); product acceptance passed 8/8. This is a bounded
protocol-leak guard, not semantic correctness or live-model repair evidence.
The historical dialogue was left unchanged; real-model behavior on the rebuilt
app remains unverified.

### 2026-11-04 · split CI browser prerequisites for failure attribution

Clean-checkout CI for `2194fc0` passed every stage in 21m52s
([41727447976](https://github.com/Unjuno/babelshelf/actions/runs/41727447976)).
Its combined Playwright `install --with-deps` step took 10m16s; completed logs
show the APT dependency stage consumed about 10 minutes, while pinned browser
downloads took about 14 seconds. A previous run completed the same combined
step in 41 seconds. Split the same Playwright 1.61.1 operation into named
`install-deps` and `install` steps so the next run identifies which phase
varies. Browser versions, Chromium/WebKit coverage and acceptance commands are
unchanged; no retries, cache or timeout relaxation was added. The verification
run [41731098851](https://github.com/Unjuno/babelshelf/actions/runs/41731098851)
has reported 27s for system dependencies and 14s for browser downloads; the
remaining acceptance stages passed, including tool/MCP, settings, editorial,
iOS handoff, offline, and installed-PWA acceptance. The clean run completed in
11m40s. Markdown acceptance also passed locally (4/4). This is one split-run
sample, not evidence that the earlier APT delay cannot recur; the delay's
origin is now attributable to the system-dependency step if it returns.

### 2026-11-04 · use remaining finite tool budget for native batches

A native batch longer than a user-selected finite per-turn budget previously
failed before executing any member, even when unused call slots remained. The
agent now runs only the allowed prefix, records each omitted member as
`tool_limit`, and carries the exhausted-budget state into answer grounding.
The planner is explicitly told that omitted calls never ran and have no
evidence. The default profile remains unlimited. Focused loop/coordinator/
conversation/submission suites passed 425/425, TypeScript and static checks
passed, and commit `2194fc0` is pushed. Clean-checkout CI passed at
[41727447976](https://github.com/Unjuno/babelshelf/actions/runs/41727447976).
This verifies the finite-batch accounting contract, not model compliance with
the resulting partial-evidence instruction.

### 2026-11-04 · bind numeric values in mixed-title comparison clauses

A reproduced water-comparison gap let a second clause assign the cited values
to the wrong titles when earlier clauses had already bound both values. The
consistency guard now binds quantities only inside each exact title's following
segment; conflicting or unassignable values fail closed and use the existing
single consistency-repair attempt. Regression was observed failing before the
fix and passing after it, including through `groundedAnswer`. Root tests passed
262/262, prototype tests 1,872/1,872, static checks passed, the app built with
165 verified assets, and product acceptance passed 8/8. This is a narrow
liquid-volume comparison guard, not general semantic entailment; live-model
repair quality remains unverified. Details are in [TEST-RESULTS.txt](TEST-RESULTS.txt).

### 2026-11-04 · expire silent runtime setup when the page resumes

The absolute runtime deadline was already checked by the watchdog and before
accepting a worker reply. A suspended page whose runtime worker never replied
could still leave the caller waiting after resume until another event arrived.
Runtime setup now checks the deadline on `visibilitychange` and `focus`, sends
the existing worker cancellation, and settles with the bounded timeout error.
The regression advances wall time and dispatches page visibility without
delivering any worker response. Runtime tests passed 21/21, the full prototype
suite passed 1,870/1,870, `npm run check` passed, the production app built with
165 verified assets, and app acceptance passed 8/8. This proves the event and
cancellation contract in local browser/runtime tests; it does not prove iOS
will deliver those lifecycle events in every suspended state or that LFM3
loads or runs on the phone. A targeted installed-PWA run is still required.

### 2026-11-04 · surface model-preparation storage pressure

The initial-preparation sheet now warns when the browser's available-space
estimate is below the selected assets and disables the download switch while
settings cannot accept changes. The estimate is advisory: it is not a quota
reservation, physical free-space measurement, or proof that a later write will
succeed. A browser regression simulates a low estimate without downloading
assets or changing the setting. Unit tests passed 27/27; the focused browser
suite passed 3/3; the full prototype suite passed 1,869/1,869; the production
app built and acceptance passed 8/8. Commit `fb96fcb` is pushed, and clean
GitHub Actions [41709690237](https://github.com/Unjuno/babelshelf/actions/runs/41709690237)
passed every stage.

The supplied iPhone report still records `runtime-setup` failure before asset
preparation (`filesPresent:false`, `assetState:not-run`) and generation. Its
generic `Error` after 1,764,321 ms does not isolate a cause. It is from a
Safari tab (`standalone:false`), not an installed Home Screen launch. The
wall-clock deadline guard rejects a late worker reply after page suspension,
but cannot run while iOS suspends the PWA. No real quota exhaustion, model
download, model load, or inference was observed in this report. A targeted
current-build installed-PWA run remains necessary to validate that specific
deadline behavior on iOS.

### 2026-11-04 · bound runtime preparation and verify public v311

The iPhone Full cycle report stopped in runtime setup after 1,764,321 ms
(29m24s), before model asset preparation, model load, or generation. The
selected model was absent (`filesPresent:false`); `expectedModelBytes` is a
manifest estimate, not measured transfer. WebGPU and shared-WASM signals are
capability prerequisites only. The generic `Error` does not identify a
device-specific cause.

Added an absolute runtime preparation deadline (10 minutes for acquisition,
3 minutes for cached verification), so repeated progress cannot keep the
operation alive indefinitely. Full cycle retries acquisition only for the
explicit `runtime-not-prepared` cache-miss result; a timeout or generic failure
is reported without a second download attempt. Focused runtime checks passed
19/19; root tests passed 262/262; `npm run check`, `npm run build:app`, and
product acceptance (8/8) passed. Clean-checkout CI
[41692622706](https://github.com/Unjuno/babelshelf/actions/runs/41692622706)
passed all stages. Public Site v311 serves build `871ece8c087af8f9`; both
`babelshelf.com/build.json` and the Site hostname returned the same build.
Actual iPhone runtime setup, model acquisition, generation, GPU use, and
installed-PWA behavior still require a targeted device run.

Follow-up `f421937` closes a deadline race after page suspension: the client
checks the absolute wall-clock deadline before accepting each Service Worker
reply, not only when the page timer fires. A controlled regression simulates a
late success after that deadline; focused runtime/device tests (24), the full
prototype suite, production build, product acceptance (8/8), and clean-checkout
CI [41706145383](https://github.com/Unjuno/babelshelf/actions/runs/41706145383)
passed. This rejects late success; it cannot keep the PWA running while iOS has
suspended it and does not diagnose the old generic runtime `Error` or prove
LFM3 compatibility. No device rerun is requested without a current-build
failure that this guard is intended to address.

### 2026-11-04 · interpret the earlier iPhone Full cycle report

The supplied report is from app build `48777327b2d5c402` in an iOS Safari tab
(`standalone:false`). Runtime setup failed after 1,764,321 ms with only a generic
`Error`; `filesPresent:false`, `assetState:not-run`, and `loadState:not-loaded`
show that model preparation, loading, and generation were never reached. The
1,049,615,680-byte `expectedModelBytes` value is manifest metadata, not evidence
that those model bytes were downloaded. Browser WebGPU/WASM capability signals
do not prove the configured runtime used the GPU. This report cannot identify
the runtime failure cause or establish iPhone model compatibility.

The current app has since added bounded runtime failure categories and separate
runtime bytes-read/downloaded counters; the old report predates those fields.
PC preflight passed 109 focused unit checks and 33 Developer UI browser checks;
clean-checkout CI [41689016571](https://github.com/Unjuno/babelshelf/actions/runs/41689016571)
passed all stages. Public Site v310 serves app build `4eafc309b4e5a18e`.
One installed-Home-Screen Full cycle rerun is needed to capture an actionable
runtime failure on this phone; because model files are absent, that test may
also prepare the selected model. No model was downloaded in this PC session.

### 2026-11-04 · retain runtime read progress in failed device reports

The supplied iPhone report stopped during runtime setup after 1,764,321 ms,
before model-file preparation or generation. It came from Safari, not the
installed Home Screen app, and gives no specific exception cause. Full-cycle
reports now retain runtime bytes read separately from network bytes downloaded,
and Developer shows that distinction after a run. Read bytes can include cache
and partial streams; they do not imply integrity success. Local regressions and
clean-checkout CI passed; public Site v309 serves app build
`b483c588fa337fcb`. Request one installed-PWA rerun to capture this field and
the exact runtime failure category. The old report does not identify the
device-side cause or establish model compatibility.

### 2026-11-04 · show byte movement during long runtime preparation

The Full cycle Developer view already shows its active step and elapsed time.
It now adds cumulative verified MB read to the live runtime preparation label,
so a single large runtime asset does not appear stuck at `0/1`. This may include
cached reads and is not a network-transfer measurement. Local TypeScript/build and
static check passed; Developer UI browser coverage passed 33/33, and the full
prototype suite passed 1,864/1,864. The provided iPhone run still failed before
model files, load, or generation; it reported no runtime transfer count. No
device-specific cause is established. Clean-checkout CI
[41679044952](https://github.com/Unjuno/babelshelf/actions/runs/41679044952)
passed every stage on `27f72ba`. This PC regression does not verify the download
on iPhone; the old report does not warrant asking for a rerun yet.

### 2026-11-04 · revalidate the proposal-to-approval boundary

The selected model can discover and read local evidence, then return a typed
correction proposal. The app persists that proposal as inert review state; only
the explicit Save action performs a revision-checked transaction and receipt.
Focused submission tests, 144 agent/evidence/coordinator tests, 7 correction UI
browser tests, and 6 review-store browser tests passed. They cover dismissal,
restart, explicit Cancel/Save, cross-tab races and bounded activity receipts.
The model cannot write through its read-only tool loop. This confirms the
existing approval boundary; it does not test live-model decision quality,
real-browser storage exhaustion, or device behavior.

### 2026-11-04 · classify runtime acquisition interruption at its source

Commit `93ef56b` limits runtime network classification to fetch failures and
preserves explicit Stop/Offline-switch outcomes; non-network `TypeError`s no
longer appear as network errors. Root tests 262/262, focused worker/runtime/
diagnostic tests 107/107, build, app acceptance 8/8, and clean-checkout CI
[41674310774](https://github.com/Unjuno/babelshelf/actions/runs/41674310774)
passed. This improves failure diagnosis only. The earlier iPhone `runtime-setup`
failure remains unexplained because its report contains only a sanitized generic
`Error` and no runtime transfer count; the model files were absent and inference
never ran. Do not claim LFM3 works on that device. A new device run is not yet
requested because the available evidence does not isolate a device-only cause.

### 2026-11-04 · diagnose runtime preparation failures without exposing private errors

An iPhone Full cycle report stopped at runtime setup before model acquisition or generation; selected-model files were absent, and its generic `Error` cannot identify the cause. The device report now records a bounded, validated runtime failure code and stage, and the Developer result shows an actionable category without retaining raw exception text. Focused local regression checks passed 92/92 across citation evidence, tool preferences, runtime preparation and device diagnostics. Clean-checkout CI [41670932817](https://github.com/Unjuno/babelshelf/actions/runs/41670932817) passed every stage on code commit `2cd989a`. The original iPhone cause, actual model generation, Home Screen launch, GPU use, offline cold restart and physical-device behavior remain unverified. No model was downloaded and no device rerun was requested. Detailed implementation/check evidence is in [TEST-RESULTS.txt](TEST-RESULTS.txt).

### 2026-11-03 · use the full standard answer allowance

The ordinary balanced answer allowance is up to 3,072 tokens, bounded by the selected model and remaining context. Planner headroom stays separate; a consistency retry is recounted and receives only the output budget that fits its revised prompt. This preserves evidence and revision checks while avoiding an unnecessary short-by-default cap. Focused tests, all 1,860 prototype tests, all 259 root tests, static check, 165-asset production build, app acceptance 8/8, and clean-checkout CI [41651902680](https://github.com/Unjuno/babelshelf/actions/runs/41651902680) passed. Real-model answer quality and physical-device behavior remain unmeasured; the public site was not redeployed for this change.


### 2026-11-03 · preserve late touch-click guards across repeated navigation

The curved touch navigation retained only the previous gesture's compatibility-click location; beginning a subsequent hold discarded it. If the browser delivered that click after the next slide selection, it could reopen navigation. A bounded, short-lived location queue now consumes only a matching touch/pen compatibility click and preserves earlier completed gestures across cancellation; mouse and keyboard activation remain separate. The reproduced out-of-order click sequence and the full editorial browser suite passed 34/34; production build and `npm run check` passed. Commit `fd69801` is pushed to `codex/ui-design-handoff`, and clean-checkout GitHub Actions [41629549504](https://github.com/Unjuno/babelshelf/actions/runs/41629549504) passed all stages. This is PC browser touch emulation, not physical iOS verification.

### 2026-11-03 · clarify LFM3 mobile execution policy

Current code uses desktop `auto` fallback to CPU/WASM only after classified WebGPU failures and confirmed cleanup; mobile user-agent/touch hints choose strict WebGPU. The model picker says `GPU route required on mobile`. This means LFM3 will not run on a mobile browser if WebGPU cannot initialize. The supplied iPhone report found an adapter but stopped generation before model loading, so it proves neither phone fit nor successful inference. No backend behavior or default was changed; matched device evidence remains required.

### 2026-11-03 · add focused Developer diagnostics and consistent overviews

Developer test options now include Offline readiness, Storage health and Runtime support alongside App & storage, Model readiness and the three model tests. Each option explains its checks before running; saved results show the same scope with ready/review counts. Result areas were split into 13 clearer categories, including separate secure-context, service-worker and installed-launch signals. All diagnostics remain local and do not load a model; offline launch, actual GPU execution and model fit are still stated as unproven where appropriate. The focused unit group passed 68/68, Developer UI passed 32/32, `npm run check` passed, and the product build verified 165 assets (shell `35aedf1d8372164b`). Physical-device validation remains open.

### 2026-11-03 · distinguish end-to-end and runtime first-text timings

The Full cycle result can report both elapsed time from Run to first text (including app checks, preparation and loading) and the inference runtime's `visibleTextTtftMs`. The latter was labeled only `First text`, which obscured that these are different intervals. It is now labeled `Runtime · first text`; a browser regression proves a 12 s end-to-end value and 0.84 s runtime value remain distinct. Developer diagnostic UI passed 31/31, `npm run check` passed, production packaging verified 165 assets (shell `b5094f783a4ad13b`), and app acceptance passed 8/8. These remain one-run measurements, not sustained speed or cross-device evidence.

### 2026-11-03 · report decision work separately from text generation

Activity summaries previously labeled measured Text-model generation calls as `Agent model calls` and omitted the completed Decision classifier's receipt interval. The summary now counts completed Decision checks separately and shows their measured receipt time; labels distinguish Text generation from decision work, and the panel says these are recorded phases rather than total turn time. The summary unit suite passed 8/8, Activity browser suite 2/2, `npm run check`, production build verified 165 assets (shell `b001af3ee0141b1b`), and app acceptance passed 8/8. Build, component tests, and receipt timing do not measure unrecorded orchestration or real model latency. Existing data and model assets were not changed.

### 2026-11-03 · check decimal-comma quantities against cited values

The source-value guard recognized grouped thousands such as `1,000 L`, but skipped decimal-comma values such as `1,5 L`; that could let an answer change the cited value without triggering this narrow consistency check. Arabic measurements now accept one- and two-digit comma decimals while three-digit comma groups remain thousands (the ambiguous `1,234` convention is deliberately not reinterpreted). Regressions prove `1,5 L` matches `1.5 L`, rejects `15 L`, and preserves `1,000 L` behavior. Answer-consistency tests passed 12/12; the full prototype suite passed 1,856/1,856; `npm run check` passed; production build verified 165 assets (shell `a37ce9525018163f`); app acceptance passed 8/8. Clean-checkout CI [41610502767](https://github.com/Unjuno/babelshelf/actions/runs/41610502767) passed every stage in 10m19s on `edd17d1`, including the repeated-touch navigation regression recorded below. These are deterministic parser/build checks, not real-model semantic entailment or live locale coverage. No original, Memory record, or model asset was changed.

### 2026-11-03 · expose diagnostic results beyond Full cycle

Developer diagnostics now include a Model readiness check that reads the selected-model file-presence signal and browser runtime prerequisites without loading, generating, preparing, or downloading a model. Each completed diagnostic report displays 11 result areas directly, including PWA access, build identity, cache, storage, Memory, model coordination, WASM, GPU capability, model files, reply, and offline restart. Reports without a mode label but containing checks receive the App & storage overview for backward-compatible readability. The diagnostic suite passed 65/65, the Developer UI suite 30/30, all prototype tests 1,856/1,856, `npm run check`, production build (165 verified assets), and product acceptance 8/8. Clean-checkout CI [41605085273](https://github.com/Unjuno/babelshelf/actions/runs/41605085273) passed every stage in 9m4s for code commit `17c46f5`, pushed to `codex/ui-design-handoff`. This is PC/build evidence and does not claim physical-device diagnostics or model execution from Model readiness.

### 2026-11-03 · bind each inference deadline to its generation

`TurnInferenceBudget` previously let a delayed timeout callback from a completed generation call `stop()` during the next generation. A regression with a deliberately queued old callback reproduced the cross-generation stop before the fix. Each call now has a monotonically increasing identity; deadline callbacks act only while their own generation remains active. The regression passes after the fix. All prototype tests passed 1,855/1,855, product acceptance passed 8/8, `npm run check` passed, and the production build verified 165 assets (`3ccd42ef42429f7a`). Clean-checkout CI [41595265292](https://github.com/Unjuno/babelshelf/actions/runs/41595265292) passed every stage on commit `e7f7025`. Site v306 is live; `https://babelshelf.com/build.json` returns build `3ccd42ef42429f7a`, and the served app JS hash matches the manifest. This covers the budget wrapper contract, not actual runtime timer scheduling on every browser or physical model cancellation behavior.

### 2026-11-03 · bind each touch hold timer to its own gesture

The 80 ms hold callback previously checked only whether any pointer press was active. If a cancelled callback was already queued when the next touch began, that stale callback could mark the new gesture held and open the navigation menu early. The timer now closes over its gesture object and only updates state when that exact object is still active. The regression deliberately replays a cancelled timer during the next touch: it failed on a rebuilt pre-fix application and passed on the rebuilt fix. The ordinary five-destination repeated touch flow and this cancellation/restart case pass; `npm run check` and the 165-asset build pass. Commit `a47e3de` is pushed and public Site v305 serves build `369c930423204e9d`. Clean-checkout CI [41593178034](https://github.com/Unjuno/babelshelf/actions/runs/41593178034) passed every stage on `ccb8ea5`, including editorial (31/31), Chromium iOS handoff (30/30), WebKit iOS handoff (30/30), and installed-PWA acceptance. Chromium/WebKit emulation is not physical iOS Safari verification; keep the iPhone interaction gate open.

### 2026-11-03 · recheck Send, tool-loop and activity receipt boundaries

The current Send and agent execution paths were rechecked with 222 focused tests. Coverage includes current-revision search/read evidence, stale paged-search invalidation, bounded protocol repair, Stop without late publish/save, one recovery opportunity after a tool failure without rerunning the same operation, storage-derived partial-work signaling when receipt capacity is the limit, paged activity concurrency, backup/restore validation, and quota rollback without repeating completed tool work. This verifies controlled coordinator and persistence contracts; it does not establish that every real small-model sequence will choose efficient tools, nor does it add a default total-call or task-time ceiling. Long varied live-model sequences remain unmeasured.

### 2026-11-03 · verify settings migration and targeted recovery in the browser

The settings contract was rechecked against current schema code and run on PC. Legacy schemas project known defaults in memory and keep the original bytes until an explicit save; unsupported future schema versions reject ordinary reads/writes, while explicit single-record recovery appends the untouched body to history. The browser recovery flow corrupts one real IndexedDB Appearance record, then restores that record without changing Models or Harness. Preference migration/recovery tests passed 40/40 and Settings/model-picker browser tests passed 18/18. This verifies the current settings boundary in controlled PC/browser flows, not cross-device storage retention or arbitrary future schemas. No user data or model assets were changed.

### 2026-11-03 · align LFM3 picker guidance with the selected device route

The LFM3 model picker always said `CPU fallback`, while the registered runtime intentionally selects strict WebGPU on iPhone/iPad/Android and refuses CPU retry there. The picker now shows `GPU route required on mobile` on those platforms and keeps `GPU preferred · CPU fallback` for desktop automatic routing, for built-in and custom LFM3 entries. This is a truthful route-policy hint, not model-fit or GPU-use evidence. Model-catalog tests passed 14/14; text-device policy, preflight, execution-route and LFM runtime tests passed 55/55; `npm run check` passed; production app build verified 165 assets. Clean-checkout CI [41587442471](https://github.com/Unjuno/babelshelf/actions/runs/41587442471) passed every stage. No physical-device run or model benchmark was performed. Commit `212e7f6` is on `codex/ui-design-handoff`.

### 2026-11-03 · keep touch navigation active across repeated gestures

The curved left navigation had several repeat-interaction failure paths. A focus-out `blur` could previously clear an active gesture; a delayed compatibility click could also arrive after a short suppression window. The subsequent pending-click counter fixed the delayed click but could accumulate when a cancelled touch emitted no click, then consume a later intentional mouse activation. The current guard instead binds suppression to the completed gesture's location and input type; keyboard activations (`detail=0`) and mouse pointer clicks are not consumed. The hold timer remains bound to its own gesture identity. The full editorial browser suite passed 33/33, including five destinations across successive touch gestures, delayed touch `PointerEvent` compatibility clicks, a cancelled hold timer, and the directly reproduced cancelled-touch → mouse-click sequence; the targeted cancellation regression passed 1/1. `npm run check`, the production app build (165 verified assets; shell `57e85be6437f4fbd`), and product acceptance 8/8 passed. Clean-checkout GitHub Actions [41610502767](https://github.com/Unjuno/babelshelf/actions/runs/41610502767) passed every stage in 10m19s on `edd17d1`, including this final regression-only test. This is browser-simulation and PC build evidence, not physical iOS touch-controller evidence; device acceptance remains open.

Follow-up: a second, independent race was reproduced: a delayed `pointercancel` or `lostpointercapture` from the previous pointer could cancel a newer active press because the handlers did not compare `pointerId`. `cancelHold` now only cancels the active gesture when event and gesture pointer IDs match. The regression replays both stale events during a second touch, then verifies the current hold still opens and selects Schedule. It failed against the unguarded implementation and passed against the rebuilt fix. Current rebuilt app: shell `d102574147be8d4d`; editorial suite 33/33, `npm run check`, and app acceptance 8/8 pass. Physical iOS touch testing remains open.

### 2026-11-03 · measure the complete selected-model path

Developer diagnostics now offer a separate Full cycle: verify or reuse the selected model/runtime, prepare missing assets only when Downloads is enabled and the browser reports Online, load the model, record time to first visible text and full bounded generation, then measure a warm response. The report distinguishes expected model size from bytes actually transferred for model and runtime, including partial failed transfers, plus load/setup time and per-stage failures. It uses the selected local model and retains its files; Quick and Performance remain no-download checks. Offline restart remains a separate PWA lifecycle check. `npm run test:prototype` passed 1,849/1,849; focused Developer UI 29/29; root tests 259/259; `npm run check`; production app build `3202fe6b94704f2c` verified 165 assets; product acceptance 8/8. These are PC code/browser checks: no model was downloaded or run during this verification, so model generation, time/quality, memory fit, thermal behavior, GPU use and cross-device performance remain unmeasured. Run Full cycle once on each target with Downloads explicitly enabled and the desired model selected; retain the bounded report for comparison. See [TEST-RESULTS.txt](TEST-RESULTS.txt).

### 2026-11-03 · keep installed-app restart guidance platform-accurate

Clean-checkout CI [41547946010](https://github.com/Unjuno/babelshelf/actions/runs/41547946010) exposed stale handoff assertions after the platform-neutral copy change. Review of its captured Linux browser report also found real iPhone-specific Airplane Mode/Home Screen directions in the generic restart path. The diagnostic now uses iOS instructions only when the bounded platform/UA identifies iOS; Windows and other platforms get installed-app/network wording, and post-restart reports use OS-neutral limits. Existing schema-1 reports remain readable; old platform-only check IDs are not rewritten in saved data. Chromium and WebKit device-diagnostic UI suites pass 28/28 each; targeted diagnostic/device-suite tests pass 46/46; root tests 258/258; prototype tests 1,844/1,844; `npm run check`; production build with 165 verified assets; product acceptance 8/8. Clean-checkout GitHub Actions [41550272524](https://github.com/Unjuno/babelshelf/actions/runs/41550272524) passed every stage in 10m23s on `c058fc8`. These checks validate wording and app behavior, not Windows model speed.

### 2026-11-03 · distinguish WebGPU absence from diagnostic failure

Developer diagnostics previously used a separate timeout race around adapter discovery. A timed-out or rejected request was recorded as `Adapter unavailable or timed out`, and the un-aborted request could make a late default-adapter retry after the report had finished. Diagnostics now use the same abortable 8-second preflight as model setup and record `available`, `unavailable`, `failed`, or `timed-out` separately. Timeout/error reports say availability is unknown and can be retried; a confirmed null adapter remains a warning that CPU/WASM may still be supported. Existing schema-1 reports without the optional status remain readable. Diagnostic tests passed 39/39; Developer browser UI 27/27; root tests 257/257; prototype tests 1,841/1,841; `npm run check`; production build with 165 verified assets; product acceptance 8/8. This improves diagnostic truth and avoids a late fallback request; it does not prove model fit, GPU use, or device performance. Clean-checkout CI is pending.

### 2026-11-03 · do not treat an inconclusive WebGPU preflight as unavailable

The bounded WebGPU preflight previously assigned `webgpu_unavailable` to both a definitive missing/null adapter and a rejected or timed-out request. LFM3 interprets only `webgpu_unavailable` as permission to retry on CPU/WASM, so transient probe failures could silently send a large model down the slower route. Missing API/null adapter remain definitive and may use the registered CPU fallback; request errors and timeouts now have separate retryable codes and remain visible instead of selecting CPU. Regression tests cover the error taxonomy, late completion after timeout, and the `auto` route refusing CPU fallback for retryable failures while avoiding model-file reads. Focused tests (48/48), root tests (257/257), full prototype tests (1,839/1,839), static check, 165-asset production build, app acceptance (8/8), and clean-checkout GitHub Actions [41530267810](https://github.com/Unjuno/babelshelf/actions/runs/41530267810) all passed on commit `0fbedec`. This corrects fallback selection and UX; it does not establish GPU availability, model fit, performance or device behavior.

### 2026-11-03 · distinguish negated location exclusions

The lexical location guard treated any nearby `exclude` / `omit` or Japanese `除外` as a request to omit the location, so `don't exclude the location` and `場所は除外しないでください` could wrongly reject an answer that included it. The guard now removes these bounded, explicit negated-exclusion phrases before checking for a positive exclusion instruction. Regressions reproduce the original false positive in English and Japanese, cover common negated variants, and retain the positive exclusion cases. Conversation plus focused exclusion tests passed 234/234; root tests 257/257; full prototype tests 1,838/1,838; `npm run check`; production shell `2b279e4479e99d82` with 165 verified assets; app acceptance 8/8. Clean-checkout GitHub Actions [41527674002](https://github.com/Unjuno/babelshelf/actions/runs/41527674002) passed every stage in 10m26s. This remains a small lexical grammar and does not interpret arbitrary negation or establish semantic entailment. No saved Memory, model assets or retained QA artifacts were changed.

### 2026-11-03 · cover generic explicit location exclusions

The prior citation/answer guard recognized meeting-place labels, but missed generic English `location` / `place` and Japanese `場所` when the user explicitly excluded them. The shared lexical guard now catches these terms in either order with explicit exclusion language and extracts matching labeled source values (`Location:`, `place is`, `場所：`) for paraphrase checks. Integration coverage confirms one correction keeps the exact citation, repeated violations fail before a saveable answer is returned, and a native terminal answer cannot bypass the same check. Ordinary positive location questions and allowed item-only answers still pass. The new case reproduced the English omission before the fix. Root tests passed 257/257; conversation tests 230/230; prototype tests 1,837/1,837; `npm run check`; production shell `ee2a79b06ca71921` with 165 verified assets; app acceptance 8/8. Clean-checkout GitHub Actions [41525306012](https://github.com/Unjuno/babelshelf/actions/runs/41525306012) passed every stage in 12m3s. This remains a narrow lexical safeguard: it does not establish general semantic exclusion/entailment, live-model quality, or device behavior. No stored Memory, model assets, or retained QA artifacts were changed.

### 2026-11-03 · enforce an explicitly excluded meeting location

A Windows Chrome Bonsai 4B run repeated a cited meeting location after the user asked for supplies only; this was reproduced on two public builds. The shared answer-consistency boundary now rejects meeting-location labels and exact location values extracted from explicitly labeled source lines when Japanese or English prompts explicitly exclude that detail. Regressions cover direct labels, copied place values, a paraphrased “meet at” form, allowed answers, a positive location question without an exclusion, one bounded repair retaining the exact source, failure on a repeated violation, and rejection of a native terminal answer. Root tests passed 257/257; prototype tests 1,835/1,835; `npm run check`; production app build (165 verified assets); app acceptance 8/8; `git diff --check`. Clean-checkout GitHub Actions [41517534275](https://github.com/Unjuno/babelshelf/actions/runs/41517534275) passed every stage in 11m45s. This is a narrow lexical scope guard, not semantic entailment: indirect aliases, implicit exclusions and unsupported claims in general remain open. No model download, stored-data mutation, deployment or live-model rerun was performed.

### 2026-11-03 · clarify the scope of Assistant generation budgets

Assistant settings previously labelled the optional limits `Generated tokens` and `Generation time`, although the implementation wraps only the Text model's generation calls. The separate Decision classifier, model acquisition/loading, token counting and registered tool work are outside this budget. Settings and before/after profile review now say `Text model tokens` / `Text model time` and state that scope explicitly. A focused Settings browser regression checks both the profile and review surfaces. This clarifies the existing contract; it does not add a task wall-time, Decision-model or tool-execution budget.

### 2026-11-03 · reject output truncated by the shared Send budget

The shared per-Send token budget could reduce a later generation allowance (for example, 256 requested tokens to 56 remaining) without exposing that effective limit to completion validation. Runtimes that return token usage but omit `finishReason` could therefore return an unfinished prose or native terminal reply as complete. The budget wrapper now attaches the effective per-call output allowance, and both grounded prose and native terminal reply validation use it. Regressions reproduce both paths at the shortened 56-token boundary and confirm the partial text cannot be accepted. Focused conversation/budget tests passed 238/238; root tests 257/257; full prototype tests 1,832/1,832; `npm run check`; production shell `f79a867a278bf352` with 165 verified assets; app acceptance 8/8; `git diff --check`. This enforces the configured token budget and completion contract; it does not measure live-model response quality or device performance. The patch is on `codex/ui-design-handoff` as commit `7d811f3`; clean-checkout GitHub Actions [41501175922](https://github.com/Unjuno/babelshelf/actions/runs/41501175922) passed every workflow stage in 11m7s. This confirms reproducibility for this change, not live-model semantic quality or physical-device behavior.

### 2026-11-03 · use locale-aware one-sentence validation

Grounded answers and native terminal replies used a punctuation regex to enforce explicit one-sentence requests. It rejected valid English answers after titles such as `Dr.` and Japanese sentences whose final punctuation was inside a closing quote. That caused avoidable regeneration or immediate refusal while preserving the same valid source. Both paths now use the existing `Intl.Segmenter` sentence boundaries; the known abbreviation-only segment is joined with the following segment. Cited answer text and source ranges remain byte-exact; no source label or citation check was relaxed. Regressions cover generated and native replies for both examples, as well as true multi-sentence detection. Focused conversation/reply tests passed 244/244, full prototype tests 1,830/1,830, root tests 257/257, `npm run check`, production build with 165 verified assets, app acceptance 8/8 and `git diff --check`. Clean-checkout GitHub Actions [41497843587](https://github.com/Unjuno/babelshelf/actions/runs/41497843587) passed every stage in 11m10s. This fixes a deterministic format false rejection; it does not prove live-model semantic grounding or platform performance.

### 2026-11-03 · preserve custom legacy harness limits

Schema-1 preference projection previously removed `maxToolCalls` from the `standard` and `source-first` profiles when their tool list and numeric cap matched an old factory default, even if the user had renamed the profile. The cap is part of the user configuration, so migration now recognizes those legacy defaults only when the canonical built-in label also matches. Regression coverage reproduces both renamed profiles, confirms their tools/caps and stored body/version/history remain unchanged, and passes the migrated two-call limit into the agent loop to verify a third call is stopped before execution. Focused preference tests passed 40/40; root tests 257/257; prototype tests 1,828/1,828; `npm run check`; the 165-asset production build and app acceptance 8/8. Clean-checkout GitHub Actions [41494897209](https://github.com/Unjuno/babelshelf/actions/runs/41494897209) passed all stages in 10m43s. This restores old user-selected budgets; it does not change current-schema behavior or grant additional tools.

### 2026-11-03 · report visible-answer TTFT for native tool turns

Commit `f3ca743` separates hidden ordinary content from the first native answer preview. When a generation contains native tool calls, the Developer report now measures TTFT to the visible answer preview; a tool-only turn reports no visible-answer TTFT instead of counting hidden preface content. Focused LFM adapter tests passed 41/41, root tests 257/257, prototype tests 1,827/1,827, `npm run check`, the 165-asset production build and app acceptance 8/8. Clean-checkout GitHub Actions [41492239936](https://github.com/Unjuno/babelshelf/actions/runs/41492239936) passed every stage, including Chromium/WebKit, iOS handoff and installed-offline acceptance. This corrects a diagnostic metric; it does not change model execution or demonstrate an inference-speed improvement. Real-model semantic quality and matched Windows/macOS/iPhone/Android performance remain unverified.

### 2026-11-03 · resolve exact saved-note citations by canonical identity

Commit `f4ee624` fixes an exact-note lookup that resolved a UUID/path, then discarded that record during a second fuzzy-match filter. Canonical paths now come from the latest saved revision, and an explicit exact match scopes the cited answer to that record. A regression covers a UUID and full path alongside a near-match decoy. Local conversation tests passed 224/224, prototype tests 1,827/1,827, `npm run check`, the 165-asset production build and app acceptance 8/8. Clean-checkout GitHub Actions [41489380684](https://github.com/Unjuno/babelshelf/actions/runs/41489380684) passed all stages, including WebKit handoff and offline/installed-PWA acceptance. This verifies exact host-side note resolution and quotation provenance; semantic entailment and live-model citation quality remain open.

### 2026-11-03 · allocate more answer room to analytical requests

Balanced replies now reserve up to 1,536 output tokens for explicit analysis, comparison, review, assessment, and equivalent Japanese requests; generation remains streamed in 768-token segments and can continue only within the total allowance. Direct short requests still receive 256 tokens, explicit long requests up to 3,072, and every budget remains bounded by the selected model's output cap and the remaining context. Focused reply-style tests passed 18/18; the prototype suite passed 1,826/1,826, `npm run check`, the 165-asset production build and app acceptance 8/8 passed locally. Clean-checkout GitHub Actions [41485398609](https://github.com/Unjuno/babelshelf/actions/runs/41485398609) passed every workflow stage. This changes available capacity, not answer quality; real-model response quality and device-specific latency remain unverified.

### 2026-11-03 · keep reviewed note proposals resumable without applying them

Commit `259cd26` stores a bounded pending note proposal as inert local review data, restores it after reload, and preserves exact source/version details for the approval screen. Editing the draft does not touch canonical notes; approval revalidates the frozen target and uses compare-and-swap with the existing atomic save/delete boundary. Explicit discard removes only that pending proposal, and backups preserve it as inert data. Focused note-review checks passed 12/12; the full prototype suite passed 1,826/1,826; `npm run check`, the production build and app acceptance 8/8 passed. Clean-checkout GitHub Actions [41478977545](https://github.com/Unjuno/babelshelf/actions/runs/41478977545) passed all stages, including WebKit, offline and installed-PWA acceptance. This closes review-draft interruption on the tested PC/browser path; it does not prove physical-device storage survival, broad live-model correction quality or iOS/Android behavior.

### 2026-11-03 · cancel a timed-out late WebGPU retry

The bounded adapter preflight now aborts its internal fallback chain when the timeout fires or the caller presses Stop. A browser adapter request itself is not cancellable, so this specifically prevents a late `null` or rejection from starting an unnecessary default-adapter request after the preflight has already ended. Regression coverage resolves and rejects the preferred request after timeout and confirms only one request in either case. Focused WebGPU preference/preflight/Decision checks passed 21/21; root tests 256/256; prototype tests 1,822/1,822; `npm run check`; production build shell `28333d6f69e17f43` with 165 verified assets; app acceptance 8/8. This improves setup/cancellation reliability and prevents redundant GPU setup work, not model token throughput. Platform-matched Windows/macOS/iPhone/Android speed, memory-fit and thermal measurements remain open.

Clean-checkout CI [41468987575](https://github.com/Unjuno/babelshelf/actions/runs/41468987575) passed every stage on commit `81027af9e7a2aa978954a13808a068b733f15f47`, including tools/MCP, device/inference/settings, editorial/iOS handoff, and offline/installed-PWA acceptance. This validates packaging and regression coverage; it is not a physical-device or real-model performance measurement.

The local Developer performance handoff now includes a coarse WebGPU vendor category and sanitized architecture hint when the browser exposes them. The label is explicitly a separate browser probe, not the inference adapter; the device name is discarded. This should make Windows/macOS/Android/iOS performance samples easier to group without claiming actual GPU placement. The short label appears in expanded technical details and in the user-requested copied report. Focused diagnostic/copy tests (50/50), the full prototype suite (1,818/1,818), `npm run check`, and the 165-asset production build passed locally. No runtime or GPU speed change was made; physical-platform model comparisons remain open.

Acceptance follow-up: the added built-app UI regression initially used an invalid saved-report fixture and timed out because the application correctly rejected it. After correcting the fixture to the schema, the focused Playwright case passed locally (1/1), and clean-checkout Actions [41461924478](https://github.com/Unjuno/babelshelf/actions/runs/41461924478) passed every stage, including WebKit handoff and installed-offline acceptance, on `e760d35`. This verifies diagnostics integration in CI, not a local-to-public deployment, a physical-device run, or faster inference.

The one-run performance summary now surfaces the runtime's Standard or Compatibility WASM mode beside the executed backend and observed GPU layers. This makes browser-specific execution-path differences visible without opening Technical details; it changes no runtime selection or inference setting and claims no speed gain. Focused Developer UI acceptance (26/26), `npm run check`, and a 165-asset production build passed locally. Physical Safari/Android/macOS measurements remain unverified.

GPU fallback diagnosis now retains only a bounded reason (`WebGPU unavailable` or `GPU model load failed`) through the LFM worker, runtime boundary and local Developer performance report. This distinguishes adapter availability from model allocation/load trouble when CPU/WASM succeeds; it records no raw runtime error and changes no backend choice or tuning. Focused fallback, metric allowlist, worker bridge and Developer UI checks pass. This improves diagnosis, not generation speed; matched Windows/macOS/iPhone/Android measurements remain required before changing platform settings.

Developer performance results now label a valid short response **Sample complete** rather than **Passed**, show runtime-reported GPU layer counts in the main result, and name the full-call tokens/s metric **Overall speed** to distinguish it from runtime decode speed. Legacy reports with a recorded performance workload but no `testMode` are also interpreted as performance samples, so they do not appear as ordinary **Passed** checks. The focused Developer UI suite (26/26) and TypeScript check passed; no inference setting or model execution path changed.

Earlier performance-result checkpoint: commit `32af507` (`Preserve legacy performance report meaning`), following `24c3385` (`Clarify overall inference timing`). Developer performance results show **Sample complete** for a valid short generation, **Overall speed** for the full-call rate, and runtime GPU-layer counts without opening Technical details; legacy reports with a performance workload but no `testMode` retain the same meaning. The focused Developer UI suite (26/26), TypeScript check and `git diff --check` passed. Inference routing and tuning remain unchanged. Cross-platform matched device performance and thermal evidence remain open.

Local experiment review: the untracked `design/prototype/lfm3-backend-bench.html` / `design/prototype/src/lfm3-backend-bench.ts` pair is a user-owned QA prototype, not product or CI coverage. Its `Run WebGPU sample` sets a sample status after nonempty generation even when `gpuOffloadLogObserved` is false; it records GPU-layer evidence but does not require it for that status. Until the prototype is explicitly reviewed and corrected, treat its timing as a generation sample only, not proof of WebGPU execution or a valid GPU-vs-CPU comparison. The files and retained QA outputs were left untouched.

### Cross-platform performance approach

Use feature and runtime evidence for routing, not OS-name guesses. The app requests a high-performance WebGPU adapter, retries the browser's default adapter selection if that preference is unsupported, verifies actual runtime execution when logs expose it, and falls back to CPU/WASM when the registered route permits it. `n_threads` is derived from shared-WASM availability and browser-reported concurrency, capped at four; this is a conservative policy, not a measured optimum. Keep a model resident between turns and reuse exact valid prompt prefixes where the selected runtime supports them.

| Target | Current route expectation | Evidence still needed |
|---|---|---|
| Windows | WebGPU through the browser's native backend when exposed; CPU/WASM fallback | Same-model GPU/CPU comparison, load/first-text/decode, memory and sustained run on representative Windows browser/driver combinations |
| Mac | WebGPU through the browser's native backend when exposed; CPU/WASM fallback | Same-model comparison on Apple Silicon and Intel Macs; browser, backend evidence, memory and sustained run |
| iPhone/iPad | WebGPU when the installed iOS browser exposes it and the pinned runtime loads; otherwise CPU/WASM where supported | Installed PWA cold/warm runs, memory pressure, interruption/recovery and sustained thermal behavior on the target iPhone/iOS version |
| Android | WebGPU on supported browser/GPU/driver combinations; CPU/WASM fallback | Same-model runs across representative GPU vendors, browser versions, memory availability and sustained thermal behavior |

These are browser-capability expectations, not guarantees for every device. Safari 26 lists WebGPU support; Chrome documents Android support from Chrome 121 on Android 12+ devices with supported Qualcomm/ARM GPUs. WebGPU does not let this web app call Metal, D3D12 or Vulkan directly; the browser/runtime selects its own backend. [Safari 26 release notes](https://developer.apple.com/documentation/safari-release-notes/safari-26-release-notes), [Chrome WebGPU overview](https://developer.chrome.com/docs/web-platform/webgpu/overview/), [Chrome Android support announcement](https://developer.chrome.com/blog/new-in-webgpu-121).

Do not change thread caps, batch sizes, context defaults, quantization, or model admission by platform until a matched run shows a repeatable benefit without quality, memory, battery/thermal or stability regressions. The next implementation step is to use the existing one-button Performance report on real Windows, Mac, iPhone, and Android devices with the same pinned model, prompt/output allowance, runtime revision, and app mode, then tune only the bottleneck the report identifies. PC/CI results cannot establish phone thermals or cross-device model fit.

Text model status now distinguishes `Loaded · GPU active` (runtime offload evidence was observed), `Loaded · GPU unconfirmed` (the requested route is GPU-capable but the runtime did not report layer placement), and `Loaded · CPU/WASM` (runtime confirmed CPU execution or the registered CPU route). This improves diagnosis and avoids presenting a configured WebGPU route as proof of GPU execution. It is status UX, not a performance optimization or an adapter/vendor identification; users still need the Developer performance report for timing and actual layer observations.

The performance-result hierarchy change above was pushed in `1cda963` and passed clean-checkout CI. It surfaces only metrics that were actually collected and keeps configured route separate from runtime-confirmed execution. No inference implementation or measured speed changed. Cross-platform matched device performance and thermal evidence remain open.

Cross-platform WebGPU adapter-selection follow-up, code commit `3713518` plus regression-test updates through `b3e8b24`: request the high-performance adapter first, then retry the browser's default selection once when that hint returns null or rejects. The shared policy covers GGUF/LFM3, Transformers.js, Decision, Vision and Developer diagnostics; explicit low-power requests remain unchanged, and cancellable probes do not start the retry after Stop. Local checks passed: root tests 255/255, prototype tests 1,803/1,803, focused GPU/runtime tests 98/98, Developer UI 25/25, static check and production build. Clean-checkout GitHub Actions [41406171044](https://github.com/Unjuno/babelshelf/actions/runs/41406171044) passed every stage in 10m55s. This improves GPU-path compatibility and setup UX; it is not a measured inference-speed gain. Matched model speed, memory and sustained-use measurements on Windows, macOS, iPhone and Android remain open.

Decision GPU-preflight follow-up, code commit `e22b97e`: the Decision worker now bounds its high-performance WebGPU availability probe at eight seconds and lets Stop interrupt the wait. Missing, rejected, or timed-out probes proceed to the packaged WASM path; a successful adapter probe is still only a hint, and ONNX session creation can still fall back independently. Focused Decision tests (18/18), full prototype suite (1,794/1,794), static check and 163-asset production build passed locally. Clean-checkout GitHub Actions [41400916820](https://github.com/Unjuno/babelshelf/actions/runs/41400916820) passed all stages in 9m11s. This removes an indefinite wait path but does not claim faster inference. Platform-matched Windows/iPhone/Android/macOS latency, memory-fit and sustained-use measurements remain open.

Previous branch head: `70ddcff` (`Report selected WASM runtime resources`). Clean-checkout GitHub Actions [41402864271](https://github.com/Unjuno/babelshelf/actions/runs/41402864271) passed all stages in 8m57s. This commit records Wllama's actually selected standard/compatibility WASM resource mode in the one-button Developer performance report and safe diagnostic handoff. It separates that resource choice from the configured backend and observed GPU layer offload; unknown modes remain absent. This improves cross-platform diagnosis, not inference speed. No Windows/macOS/iPhone/Android model throughput, memory, or sustained-run comparison has been completed.

Latest pushed commit: `add8181` (`fix: report observed LFM GPU execution accurately`); clean-checkout workflow [41399403153](https://github.com/Unjuno/babelshelf/actions/runs/41399403153) passed all stages in 11m59s. WebGPU is now reported as the executed backend only when the pinned runtime log confirms a sane nonzero layer-offload count; explicit CPU remains CPU/WASM, while zero, missing or inconsistent GPU evidence is “Not confirmed.” The evidence carries across warm model reuse, and arbitrary metadata/model text no longer counts as an offload log. Focused adapter/runtime tests (77/77), Developer diagnostics UI (25/25), static check and the 163-asset production build passed locally. This corrects observability; it does not speed up inference. No physical Windows, iPhone, Android or Mac benchmark was run. Platform-specific matched speed, fit, memory and sustained-run evidence remain open.

Latest pushed commit: `e4a9d2c` (`fix: bound LFM3 WebGPU adapter preflight`); clean-checkout workflow [41396758534](https://github.com/Unjuno/babelshelf/actions/runs/41396758534) passed all stages in 9m49s, including device memory/inference/settings, editorial/iOS handoff, and offline/installed-PWA acceptance. Previous head `daa3321` also passed workflow [41393843034](https://github.com/Unjuno/babelshelf/actions/runs/41393843034). Windows/iPhone/Android/macOS matched performance, model fit and sustained-run comparisons remain open.

The LFM3 WebGPU adapter preflight is bounded to eight seconds; missing/null/rejected/timed-out adapter outcomes are normalized for the existing CPU fallback, and Stop aborts the pending check. Stop remains a terminal cancellation, not a fallback trigger. Local `npm run check`, prototype tests (1,788/1,788), product acceptance (8/8), focused preflight/runtime/model/device checks (59/59), production build (163 verified assets), and `git diff --check` passed. This improves startup reliability and recovery UX; it is not a measured speedup. The separate Qwen3 GPU rebuild did not complete because the pinned upstream submodule transfer stalled; no experimental runtime was registered or shipped. Cross-platform actual model speed and fit remain unverified.

Image-model setup UX follow-up: the bundled and custom LFM2-VL route requires WebGPU. Before acquiring the built-in Vision runtime/model assets, the app now requests a high-performance adapter with an 8-second bound; missing API/adapter, request failure and timeout return distinct retryable messages. Stop aborts the preflight and prevents the subsequent runtime acquisition. The Vision worker uses the same bounded check before session creation, so a capability probe is not treated as proof that model loading or inference will work. Focused Vision/automatic-reading checks (29/29), root static check, and the 163-asset product build passed locally. This avoids needless large downloads on unsupported browsers; it is not an inference-speed improvement, and platform-specific model fit/performance remains unverified.

Latest cross-platform CPU-fallback checkpoint: commit `be146c0` removes the pinned single-thread setting from the D1 ONNX worker and lets its pinned runtime apply its cross-origin-isolation-aware thread policy. The focused decision tests (9/9), prototype suite (1,775/1,775), root check and app build passed locally. Clean-checkout GitHub Actions run [41384082884](https://github.com/Unjuno/babelshelf/actions/runs/41384082884) passed all stages, including device/settings, iOS handoff, and offline/installed-PWA acceptance. This is configuration and CI evidence only: no latency gain is measured, and Windows/iPhone/Android/macOS matched model runs remain open. Existing dirty and untracked QA artifacts were preserved.

Runtime-policy regression follow-up: the D1 asset test now also inspects the pinned ONNX WebGPU bundle for the runtime's default WASM thread policy (one without cross-origin isolation; otherwise at most four, based on half the reported logical cores). This will flag a pinned runtime upgrade that changes that policy for explicit review. Focused decision tests (9/9), full prototype tests (1,775/1,775), root check, and `git diff --check` pass locally. Clean-checkout GitHub Actions [41385248922](https://github.com/Unjuno/babelshelf/actions/runs/41385248922) passed every stage in 10m30s. This static contract test does not measure actual runtime threads or performance.

Tool-documentation contract follow-up: the regression suite now checks that the current protected Tools README names every capability in the custom-tool allowlist and states the actual no-network/no-direct-write/no-permission boundary. This prevents the visible guide from drifting as the QuickJS capability set changes. Built-in migration and QuickJS clock tests (10/10), full prototype suite (1,775/1,775), root check and `git diff --check` pass locally; clean-checkout GitHub Actions [41386321953](https://github.com/Unjuno/babelshelf/actions/runs/41386321953) passed every stage in 8m15s. No runtime/tool behavior changed.

Public v301: application commit `542bd5d` / build `84d4d575338b7300`; CI41366532048 passed all stages. Deployment `appgdep_6ae7d99f41dc8191b07d6764665235da` succeeded and Site reports `https://babelshelf.com` public. The app commit rejects incomplete device performance samples instead of counting truncated output as a pass. Real-model speed and physical-device behavior remain unverified. See TEST-RESULTS.txt.

Cross-platform CPU fallback follow-up, 2026-11-02: removed the app-wide `numThreads=1` override for Transformers.js/ONNX Runtime WASM. The pinned ONNX Runtime now selects its built-in policy: one thread when cross-origin isolation is unavailable, otherwise up to four from the browser's logical-core count. This affects text, speech and image workers that share this runtime helper; it does not alter WebGPU routing, model files, or saved data. Focused worker/runtime checks (4/4), all prototype tests (1,775/1,775), root static check, and production build pass. No model-speed gain is claimed; matched Windows, iPhone, Android, and macOS runtime samples remain necessary before platform-specific tuning.

Decision CPU-fallback follow-up, 2026-11-02: removed the separate `numThreads=1` override from the D1 ONNX worker. The pinned D1 ONNX Runtime uses the same adaptive default (one thread without cross-origin isolation; up to four based on browser concurrency when available). WebGPU remains the preferred route when the adapter/session works; this only changes its CPU/WASM fallback. Decision asset/runtime tests (9/9), prototype suite (1,775/1,775), root static check, and production build pass. This aligns fallback behavior; no D1 speedup has been measured on a target device.

Developer performance UX follow-up, 2026-11-02: the one-run report now displays runtime-reported thread counts as requested vs reported values when the engine provides them, alongside the already separated configured backend, executed backend, GPU layers, prompt processing, first token, and decode speed. This is diagnostic disclosure, not proof of CPU utilization or a speedup. Developer UI checks passed 24/24; root static check and app build passed.

Repository HEAD `5b93514` passed clean-checkout CI [41373012895](https://github.com/Unjuno/babelshelf/actions/runs/41373012895). It fixes the transient service-worker registration state that blocked an isolated Q8 preparation flow before model discovery; the updated offline-shell lifecycle test and PC build pass. Public Site remains v301; Q8 model import/generation after the fix and physical-device performance remain unverified. Detailed evidence is in [TEST-RESULTS.txt](TEST-RESULTS.txt).

Current workspace follow-up: the first-install failure observer now retains a `redundant` worker's failure after the browser clears `registration.installing`. Before the fix, the new lifecycle regression reproduced `Checking` instead of `Preparation failed`; afterward the two offline-shell suites passed 27/27. `npm run check` passed and the production app packaged 163 verified shell assets. This does not claim a GPU speedup or physical-device acceptance; cross-platform runtime performance remains an open gate.

Current workspace follow-up: the built-in tool audit SHA now includes the frozen tool definition (effect, network declaration and input schema) as well as entry/source files, using canonical JSON key order. Regressions reproduce the old identical fingerprint for changed contracts and the key-order instability, then pass after the fix. This closes provenance gaps in tool receipts; it is not an inference-speed optimization. The shared WebGPU/CPU routing and runtime-reported measurements remain capability-driven; platform-specific tuning still needs matched Windows, iPhone, Android and macOS runs. No device speedup is claimed.

Current workspace follow-up: commit `5108eb7` makes explicit offline-app preparation retry registration when a previous first install left an unusable registration with no active, installing, or waiting worker. A healthy existing worker is reused. Offline-shell lifecycle checks (28/28), Settings UI checks (11/11), root check, production build (163 verified assets), and `git diff --check` passed locally. Clean-checkout CI [41387632055](https://github.com/Unjuno/babelshelf/actions/runs/41387632055) passed every stage. This fixes a retry path; it does not establish offline cold-restart acceptance on a physical device. GPU optimization remains capability-based, and matched Windows/iPhone/Android/macOS speed, memory and sustained-run data are still open.

Current GPU routing follow-up: commit `6a10a8f` makes the shared Transformers.js runtime explicitly request `powerPreference: high-performance` for ONNX WebGPU profiles, including text and vision. Source inspection confirms pinned Transformers.js 4.3.0 already sets this preference internally, so the app-level assignment codifies the current policy and protects it from a future dependency-default change; it does not improve this pinned runtime's current behavior. Speech is currently WASM-only, so the preference does not accelerate its current route. Initial CI [41388917887](https://github.com/Unjuno/babelshelf/actions/runs/41388917887) caught a Vision source test pinned to the former inline assignment; commit `01b5978` updates it to verify use of the shared runtime plus the explicit adapter preflight. Local focused checks (10/10), all prototype checks (1,776/1,776), root checks (254/254), static check and production build pass. Clean-checkout CI [41389185820](https://github.com/Unjuno/babelshelf/actions/runs/41389185820) passed every stage. This does not identify the adapter selected by the browser, change models to WebGPU automatically, or establish a speed gain. Matched device benchmarks and actual WebGPU-vs-WASM comparisons remain open on Windows, iPhone, Android and Mac.

Current diagnostics follow-up: when the selected runtime supplies `runtimePrefillMs`, Settings → Developer → Performance now shows `Prompt processing · runtime` beside first-token and decode speed. It remains hidden if the runtime does not report it. This separates prompt-processing delay from token decoding for diagnosis; it changes no model execution policy and claims no speed improvement. The UI regression, 163-asset product build, and static check pass locally; the clean-checkout workflow is pending for the combined branch head.

Cross-platform performance follow-up, 2026-11-02: reran `npm --prefix design/prototype run test:runtime -- tests/device-diagnostics-ui.spec.ts --workers=1`; all 23 cases passed, including configured route vs executed backend, runtime GPU-layer evidence, first-token/prefill/decode reporting, and the one-run local diagnostic flow. GitHub Actions run [41377578841](https://github.com/Unjuno/babelshelf/actions/runs/41377578841) then completed successfully for the corresponding code commit `dea42c2`; the later `d8020e2` change is documentation-only. The existing in-app sidebar browser could not be claimed by the computer-control session, so no live Windows model timing was collected in this follow-up. Current code remains capability-driven across Windows, iPhone/iOS, Android and macOS; do not add platform-name-specific GPU tuning until a matched runtime measurement shows a benefit. Real GPU speed, model fit, and sustained behavior on each physical platform remain open gates.

Repository checkpoint 2026-11-02: commit `4609691` gives device-test output-limit and empty-output failures stable diagnostic codes, and displays the output-limit case as `Incomplete output` in Developer settings. Performance instructions now say `May use more battery`. The focused model-test checks (2/2), diagnostics UI (23/23), Settings UI (16/16), full prototype suite (1,766/1,766), app build, and root check passed locally. GitHub Actions run [41368020756](https://github.com/Unjuno/babelshelf/actions/runs/41368020756) passed every clean-checkout stage in 10m28s; no public deployment was made for this follow-up. Device-specific WebGPU tuning remains gated on matching device measurements; Windows/sidebar runtime evidence is in `LFM3-RUNTIME-SPIKE.md`, while iPhone/Safari, Android, and macOS remain unverified. Do not infer GPU support or performance from OS names or adapter availability alone.

Repository checkpoint 2026-11-02: commits `28e5e55` and `5220b80` request the browser's `high-performance` WebGPU preference in the LFM3 and Developer diagnostic paths, and label that as a preference request rather than proof of hardware selection. The full prototype suite (1,766/1,766), `npm run check`, and production build passed locally; focused diagnostic/device checks passed 37/37. Clean-checkout GitHub Actions run [41371180146](https://github.com/Unjuno/babelshelf/actions/runs/41371180146) passed every stage, including offline and installed-PWA acceptance. This is a routing/diagnostic correctness improvement, not a measured speedup. The registered LFM3 route requests WebGPU/all layers and can fall back to CPU/WASM after confirmed cleanup; browser-selected graphics APIs remain implementation-dependent. Windows has limited single-device measurements in `LFM3-RUNTIME-SPIKE.md` and `DEVICE-DIAGNOSTICS.md`; matched model/backend comparisons, sustained thermal behavior, and physical iPhone, Android, and Mac measurements remain open. Keep each platform on the common capability-based route until device evidence supports a specific tuning change; do not add OS-name heuristics or claim Metal/D3D12/Vulkan use from WebGPU availability.

Platform compatibility reference checked 2026-11-02: WebKit lists WebGPU as a Safari 26 feature for Apple platforms ([Safari 26 release notes](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)). Chrome's WebGPU overview documents desktop Chrome support for Windows devices with D3D12, macOS, and Android 12+ devices with Qualcomm or ARM GPUs ([Chrome WebGPU overview](https://developer.chrome.com/docs/web-platform/webgpu/overview/)). These are browser/adapter availability conditions, not LFM3-runtime, PWA, model-memory, generation, or performance acceptance. Keep the diagnostic capability-driven and test the exact browser/device combination; an unsupported or unavailable adapter must retain the registered CPU/WASM path where compatible. The implementation has no verified native Metal, D3D12, or Vulkan selector: those are browser/runtime implementation details, not app-level platform promises.

Previous Public v298: application a0c4962/build06ed16be77948f25/index-B2O0rWzh.js. CI41352040901 passed all stages. Deployment appgdep_6ae7b12f7e30819188101b3614407037 succeeded; sidebar Update adopted the exact entry and retained conversation and QA-LFM3-source-check input reference. Consecutive identical planner-fit checks are reused within one preparation only; Context19, conversation/planner222, root check/build and app8 pass. Real-model latency benefit remains unmeasured. Previous v297 shared reply guidance and full cached-input accounting remain included.

Latest v298 LFM3 replay: original-ID read → answer → original-v1 citation → exact save preview passed; cancelled save to avoid duplicate QA data. 2model calls280.5s,9135input/1398output,1408cache tokens on secondcall. Full input accounting confirmed. Internal IDs/tool syntax remain in prose; response latency still unacceptable. It reused a source ID in history, not new search/provenance traversal. See dated evidence.

Prior public v296 sidebar LFM3 QAD Q4_0 sample completed memory.sources → memory.read → native answer → original-v1 citation → approved exact save. One QA note retained; original model selection restored. Three model calls383.3s; 1408 cached tokens on calls2/3, runtime reports25/25 GPU layers. Slow input processing and verbose internal IDs in the reply remain defects; this is not search-discovery or cross-device acceptance. See the dated LFM3 provenance entry in TEST-RESULTS.txt.

## Earlier checkpoints (historical; not the current status)

Public v296: build d44a00bdc3bc531f / index-D5Q4vgV3.js; CI41347653011 passed all stages on 8f03f3f. Deployment appgdep_6ae7a534c64c81918f024f0eea6da9c2 succeeded. Sidebar Update adopted the exact entry, preserved conversation, and returned to app Offline. Actual-model replay failed: both planner attempts chose recall/current with missing query; no tools, answer or save. See v296 replay in TEST-RESULTS.txt.

Included in v296 (cc41077): text.inspect records inference metrics on success/failure and contributes to Turn work summary. The planner now distinguishes dialogue recall from verification of saved-note sources; memory.sources guidance applies only when that tool is offered. Controlled workflow/summary checks: 75 passed; routing/harness/workflow checks: 73 passed; static check passed; latest build d44a00bdc3bc531f has 163 verified assets. Actual model routing and latency improvement remain unverified. Commit f91b775 avoids cancelling code verification for push updates limited to the two evidence reports; PR/manual checks remain unfiltered.

Public v295: applicationd83bd7b/build ebdec491d8c26b9b/index-9pe-xlNI.js; CI41344827895 all stages passed. Deploymentappgdep_6ae79d3b057c81918662a50eaa625677 succeeded. Sidebar Update verified exact entry and retained history; restored appOffline. Regenerated dialogue and literal replacement no longer inherit unread factual citations; exact-copy save and lossless formatting retain refs. Controlled regression/build checks pass. Actual post-update generation remains unverified; prior performance/provenance failures below remain open.

Public v294: application60a15d2/build98e853bd7470f99a/index-Cmkr6sV6.js; CI41343063954 all stages passed. Source11d104dac54377d280eb7ba0c040d9702d0aa696; deploymentappgdep_6ae798bcdfd88191aa7a6024211d0524 succeeded. Sidebar Update verified exact entry, retained history and returned appOffline. Compact standard guides and exact protected-guide migration are deployed; prototype1757/app8/build/check pass.

Actual v294 replay completed without context error but did not follow original provenance: selected recall/current, not memory.sources. Planner1797prompt/20output/82.777s, TTFT80.677s, decode9.057tok/s,cached0. Recorded partial total: 2 calls, 2116 prompt tokens, 25 output tokens and 91.0s; this excludes the then-uninstrumented text inspection call. Final reply says original could not be verified; UI source opens earlier saved answer v1, not primary original. Exact final text and one source reached save review; cancelled without creating a QA note. Compared with v2931881prompt this run used84 fewer planner tokens, but history differs and latency worsened: no controlled speed gain or provenance acceptance. Investigate planning/context overhead and actual runtime execution before claiming GPU optimization.

Historical v293 failed invalid target followed by context overflow during bounded repair. Its receipts remain in TEST-RESULTS.txt.

Historical v292 replay passes preflight but fails model target validation: turn d8c427f8-a9b5-497a-870c-a29b45e01fef, Bonsai4B/context2048. Compaction3calls/887input/194output/49.382s; planner1882input/14output/max166/45.523s, TTFT44.036s,cached0. Invalid target, no tool execution, answer or save. Tool profile retained3calls with source details enabled. This is not provenance acceptance or a demonstrated speed gain. Fixed protocol leaves too little headroom; inspect target-contract clarity and recovery without bypassing validation.

Changes: fresh Standard/Source first include memory.sources; stored profiles remain unchanged. JSON-planner guidance is shorter without removing schemas, validators or budgets. Prototype1754/app8/build/check passed. Existing sidebar profile has search/read/calculator/source details and three-call limit (only Source details was enabled through UI for testing).

Performance evidence: latest completed v289 saved-material replay used cached Bonsai4B, three calls2249prompt/79output,101.3s aggregate generation; final630prompt/38output,19.077s generation,15.266sTTFT,3.810sdecode,cached0; search45ms. It cited a saved answer, not the primary original. Model/session reuse exists; repeated loading or GPU bottleneck is not established. Investigate planner/prefill overhead without changing trusted-message semantics merely for cache hits.

Remaining: model-selected provenance navigation, grounded instruction following, latency, physical-device performance/offline restart and real quota/eviction behavior. Not release-complete. Detailed dated receipts are in TEST-RESULTS.txt; reuse existing QA artifacts and preserve data.

Public v289 follow-up: prose continuations now respect custom-model output caps and reject invalid tokenizer counts before generation. Shared count validation also covers evidence packing and citation repairs. Late router generation completions after abort/unload are also rejected. Prototype1751/app8/build2e32709bcc9aad04 pass; CI41335227459 passed all stages. Site289 is public; sidebar Update adopted index-__9IIVr2.js/build2e32709bcc9aad04 with retained history and returned appOffline. This is not a measured speed improvement.

Public v288 follow-up: generic dialogue history now scales to 42% of the selected context instead of min(850,42%). Exact total counting and 512-token reply reserve remain. Controlled 8192-context test avoids unnecessary model compaction above850 tokens; no real-model speedup is claimed. Prototype1747/1747, app8/8 and build546f0f1936500d52 pass. CI41333230189 passed all stages. Site288 is deployed; sidebar Update adopted index-DmgXQouA.js without storage reset, retained dialogue and returned app Offline. Site287 measurements below remain historical, not a v288 speed measurement.

Application 6bf8fe9 is public in Site 287: build 4d72faea1076cff2 / index-CmzM1_EI.js. Existing sidebar updated without data deletion and returned to app Offline (not OS network isolation).

Actual cached Bonsai 4B / context 2048 completed the observatory story: 4 model calls, 2,694 observed prompt tokens, 378 output tokens, 108.6 s aggregate generation. Final answer: 307 prompt / 231 output tokens, TTFT 7.933 s, decode 23.837 s, generation 31.771 s. Unchanged final text reached save review; cancelled to avoid a duplicate QA note.

A subsequent desert-library story visibly streamed from “The sun” to a growing paragraph while Generating and Stop remained available. Stop removed partial output, restored the request draft and controls, and offered no partial-answer save. This verifies real WebML prose preview and cancellation on this Windows sidebar. Error/late-event paths have controlled regression coverage, not a newly induced live GPU failure. Current-run citation and committed-save persistence were not retested. Prototype 1745/1745, app 8/8 and production build passed; CI 41332393009 is tracked in TEST-RESULTS.txt.

Latency remains inadequate: repeated context/planning calls dominate this sample. No intervention-based GPU speedup or physical iPhone/Android/macOS acceptance is established. Prior grounded-answer instruction-following failures remain open. Next work should reduce avoidable orchestration/compaction work, then measure runtime optimizations separately from task latency. Preserve existing data and do not repeat fixture-specific prompt tuning.

This is not release-complete. Use dated receipts below for historical evidence.

Earlier sidebar save-review run adopted build59393616b2cea3cd/index-CXv6ShF1.js; the newer5f0d165f57588d35 timing run is recorded in TEST-RESULTS.txt. With no selected file, cached LFM3 Q4 and app Offline, a natural saved-material question completed search → answer → exact cited-v1 preview → unchanged save review. Unrelated history compaction no longer blocked this request. The source was an existing saved answer, not a newly verified chain to the first original. Save review was cancelled to avoid duplicate QA notes. Activity measured2 model calls and129.8s aggregate generation; latency remains inadequate. LFM3 Q4 remains selected. Earlier original-citation → approved-save → reopen evidence is historical, not a claim that this latest replay persisted a new file. Physical offline restart, device compatibility and broad quality are still unverified.

Unresolved Bonsai real-model gate: local build44804e8720f47b1d (6c890cc) failed the one-sentence Japanese summary request on the existing QA-agent-current v1. Bonsai4B returned an English insufficient-evidence refusal despite summarizable content; summary routing was confirmed. The receipt measured two calls totaling99.7s, with21.362s in final answer. These are partial measurements: the then-unmeasured read/search completion classifier is excluded, so this is not total inference time. No answer was saved. The public excluded-detail failure also remains unresolved. Do not repeat fixture-specific prompt tuning or treat earlier successful samples as superseding these failures. Physical iPhone/Android/macOS performance and broad acceptance remain open. Conditions and immutable model/runtime revisions are in TEST-RESULTS.txt.

Latest focused regression: completion accounting ec18b4b passed conversation/resolved-actions219/219; subsequent proposal accounting passed resolved-actions/work-summary22/22. TypeScript/product build f59fd4c1af91d26d and app packaging8/8 passed locally. Both classifier and proposal metrics now use the shared bounded observer; old receipts are unchanged. These accounting changes are public in Site272. Runtime cache benefit from prefix separation remains unmeasured.

- Implemented: optional cumulative per-Send text-generation token/time budgets (unlimited defaults), schema-2 profile projection without stored-byte rewriting, revision-aware approval, and bounded grounded-answer consistency repair. Comparison checking now validates stated values without requiring every retrieved note in the answer. These lexical checks do not establish general semantic entailment.
- Earlier broad regression scope (before current focused changes): full prototype 1,685 passed and root static check passed after the settings fix. Schema-2 tool selections and call limits survive projection and explicit save with old bytes retained in history. The shared prepared backend preserves bounded runtime-reported execution route on initial load and reuse. A controlled late model response at the Send deadline cannot publish an answer or open save review. These are Node/controlled-inference checks, not real-model quality, GPU-placement or physical-device evidence.
- Earlier sidebar acceptance (historical build, not latest): existing in-app browser only, with retained data. Local build `a7b89e70cae4a207` / `index-DobGHT8z.js` was adopted through Update and returned to app Offline. Earlier natural-language Memory search → grounded answer → original-v1 citation → reviewed exact save passed for one Bonsai 4B sample. On that earlier build, the same bound-file question produced the correct answer: cold-after-update generation 35.960s, followed without reload by 5.764s with 470 cached tokens; both used 584 input and 26 output tokens. This demonstrates existing session reuse, not an intervention-based speedup or general performance. Exact phase measurements and revisions are in [TEST-RESULTS.txt](TEST-RESULTS.txt), entry “Sidebar runtime TTFT receipt (f093433)”. Broad task quality, physical iPhone/Android inference and offline restart, genuine storage exhaustion, runtime redistribution review, and public-build adoption remain open.
- Cleanup: desktop shortcuts are absent. On 2026-11-01, 372 obsolete QA result/fixture directories were archived locally with per-file SHA-256 verification and removed, leaving 370 Temp directories. Regenerable GPU/shader/code caches were removed from inactive QA profiles; net logical size reduction was 1,870,746,253 bytes. Models, IndexedDB, OPFS, Local Storage, CacheStorage and HTTP cache were preserved. Remaining directories include 367 storage-bearing profiles, two recent failure reports and one Git deployment checkout. Archive and exact path inventory stay local outside the repository; do not upload them. The standard installed-PWA QA lifecycle already cleans its owned temporary artifacts.

This is not release-complete. Use the acceptance matrix and dated evidence below to distinguish implementation from verified behavior.

Earlier clean-checkout verification: repository commit `b3176b60b0a427996dbb756d87796479291c9ee4` passed every staged GitHub Actions gate in run **41280182608**: https://github.com/Unjuno/babelshelf/actions/runs/41280182608. It includes the code state from `bda8818dc4cc2aef8883da432d9731ad0f12a339`; `b3176b6` only marks the historical completion audit as superseded and links current acceptance gates. These checks do not verify actual model generation, fallback on a physical device, or real storage exhaustion. Earlier toolchain reproducibility runs are preserved in [TEST-RESULTS.txt](TEST-RESULTS.txt). A fresh Windows Temp scan on 2026-11-01 found 742 direct BabelShelf-named temporary directories: 327 names containing `profile`, 303 containing `results`, and 112 other names. Their descendants total 35,001,050,772 bytes by summed file lengths (logical size, not measured physical disk allocation); large directories contain local model-cache files. This broader name-based inventory supersedes the earlier installed-PWA-only counts below. No profile, model cache, or evidence data was deleted.

Citation repair follow-up (2026-11-01): multi-source numeric water comparisons now require each distinct cited value to be bound to exactly one source title in its sentence/clause; an unlabelled list of otherwise valid values is rejected as ambiguous. The grounded-answer route makes one bounded correction attempt against the same source excerpts and citation protocol, then fails closed if the second draft still conflicts or remains ambiguous. Prompt guidance asks for exact source-title/value pairing. Windows PC root tests passed 250/250, prototype 1,676/1,676, answer/conversation 209/209, submission 86/86, app acceptance 8/8, `npm run check`, and production build (163 verified assets). These checks do not establish live-model correction quality or general semantic entailment; the original sources remain unchanged and the retry does not save automatically.

PC offline Memory-create follow-up (2026-11-01): in the existing isolated Chrome QA profile, build `07fbf22e5baf85cc` was cold-opened with browser networking disabled (`navigator.onLine === false`) while its service worker controlled the page. The explicit `Remember:` flow displayed `Saved · Inbox/...md`; a read-only IndexedDB inspection confirmed the exact synthetic QA body and path. No external requests or page errors were observed. An initial UI assertion expected a `History` control after save, which is not present on that screen; the saved status and persisted record were independently confirmed. This proves one Windows PC browser offline create/save path only, not iOS/Android behavior, model inference, or full offline workflows. QA profile retained.

Citation consistency follow-up (2026-11-01): Exact-title water comparisons now reject an explicit English/Japanese more/less claim that conflicts with one unique cited volume per note, including when answer title order differs from citation order. Overlapping titles bind to the longest matching title; duplicate titles and ambiguous multi-volume sources remain unchecked rather than guessed. Focused and full PC checks are recorded in [TEST-RESULTS.txt](TEST-RESULTS.txt); general semantic entailment and live-model retry behavior remain unverified.


Citation distance parsing follow-up (2026-11-01): grouped thousands separators are preserved during clause splitting and parsed distinctly from decimal commas. English/Japanese regressions cover correct and reversed location rankings. Full clean-checkout CI **41265716951** passed on `a070e2721ce64d7e2ef07f34c09bb4f9731e829a`. General semantic entailment remains an open gate.

Legacy backup schema hardening (2026-11-01): schema 1 is the historical note-only backup format. `parseStateBackup` rejects extra payload fields such as settings/runs at the schema-1 boundary, even when the payload checksum is valid; this prevents unsupported state from reaching restore review through the permissive legacy note parser. Valid note-only schema-1 backups remain readable. Follow-up validation also requires the exact historical outer wrapper keys. Clean-checkout CI **41262141210** passed all stages for branch HEAD `4f1902f6ec47e2da36b7f55ab2c1f53e8a80f612`. No user backup or local data was changed.

Current backup schema boundary (2026-11-01): schema-2 restore now rejects unknown wrapper or payload keys rather than silently ignoring fields that the current restore planner cannot preserve. The exact schema-2 exporter shape and existing schema-1 note-only reader remain supported. Focused, root, prototype, static, production build, app acceptance and real IndexedDB review-store checks passed locally; clean-checkout CI **41261376687** passed all stages. No user backup or local data was opened or modified.

Activity work-summary accuracy (2026-11-01): the rollup now counts model calls only when a receipt explicitly records `measuredModelCalls`; a successful plan receipt or token-count timing alone does not imply a generation occurred. Prompt/output/timing and registered-tool totals remain separately reported when measured. Root tests 250/250, prototype tests 1,665/1,665, static check, product build (`2f01916be6bd2376`, 163 verified assets), app acceptance 8/8, and review-store/Activity browser acceptance 6/6 passed locally. Clean-checkout CI run **41263749120** passed all staged gates in 11m25s on commit `f20623bca3db9d852031cb033d54888d2ae27b6a`. These are PC/CI checks, not real device performance evidence; cumulative per-turn compute-budget enforcement was unimplemented at that checkpoint (superseded by `e375dd0`, recorded below).

Activity receipt privacy change: malformed model plan/source output remains available to the transient in-turn repair handler, but is not copied into durable Activity receipts. Receipts keep the validation reason, raw byte count and truncation flag; historical receipts are not rewritten. Commit `25b7b9542a1aad4daa7fecf974b5e022d7cf9ebd` passed complete clean-checkout CI **41240158216**. This does not establish physical-device or live-model quality.

QA shortcut cleanup: commit `2c237913bb96679d7f02c9c82d6d3b754480fa34` passed complete clean-checkout run **41238375715** in 10m35s. Desktop and Chrome/Chromium Start Menu scans found zero remaining BabelShelf QA links after removal of 134 verified QA shortcuts. No personal profile was targeted. The 101 isolated QA profiles and 106 result folders were preserved; the local automatic approval review rejected their deletion.

Interrupted-QA shortcut cleanup follow-up (2026-11-01): a generated UUID-named temporary Chrome profile could remain after process interruption; the old scanner removed its app shortcut only after that profile had disappeared. Cleanup now removes the precisely named QA `.lnk` while preserving its profile and all profile contents. The focused Windows path-ownership suite passes 6/6 and the actual installed-PWA run passes with the app unregistered, fixture server stopped, and its temporary test profile removed by that test's own lifecycle. No broad Temp cleanup was run. This does not prove cleanup after abrupt process termination on every Windows configuration; a subsequent installed-PWA QA run is the recovery point.

Citation hardening commit `7dce0e33a033fd7a61cb814bde67af17c2cfe942` passed clean-checkout CI run **41235492468** in 10m59s. It binds a named answer quantity to its uniquely nearest cited note title in English and Japanese. This narrow deterministic guard does not establish semantic entailment or close physical-device/live-model limitations.

Citation follow-up (2026-11-01): A generic “compare the cited reserves” request previously bypassed title-to-amount binding if the model introduced file titles only in its answer. The guard now binds exact titles for single-title answer clauses and splits semicolon/Japanese-comma clauses. A 2026-11-04 regression found that a later mixed-title clause could contradict those bindings; numeric values are now assigned within each title-anchored segment and ambiguous/unassigned values fail closed. General multi-source entailment remains unresolved.

The verification-record commit `f57227b5bf54eabdf2b7f3ec8d2c9c1eb708a8aa` also passed clean-checkout CI run **41227207361** in 8m21s. All workflow gates passed on the pushed branch; device and live-model caveats above remain unchanged.

Latest clean-checkout CI run **41226345432** passed in 10m19s on the documentation follow-up commit `8f3e21292c9fba0c62123e81b018ad5eb64c81fe`. All workflow stages passed: core/build/acceptance, review and offline calculation, tools/MCP/Markdown, device/settings, editorial/iOS handoff, and app-update/offline/installed-PWA. The implementation change is `57a28430a14ce2116462667667969177c023e9ab`; its dedicated full rerun **41224873205** also passed. These PC/CI results do not establish live-model mobile inference, physical offline cold start, or exhaustive migration behavior for every historic backup.

Preference migration follow-up commits `5edc3d7` and `897391f`, plus the regenerated offline shell `4488cfb`, passed full clean-checkout CI **41214132530** in 9m05s. Local `npm test` passed 246/246 after those changes. Schema-2 settings preserve explicit current values while projecting v0/v1 records in memory; the service-worker network authority accepts schemas 1 and 2 and rejects future or malformed versions. These checks establish the current code path, not an exhaustive audit of every deployed user backup.

Latest citation hardening commit `9dcb50ce1ea578af2a801c0c479d945be88a1de9` passed complete clean-checkout CI **41210762301** in 9m26s. The deterministic comparison-identity change is covered by CI; this does not establish general semantic entailment or live-model/device behavior.

Product commit `21b7901055cb54587d69895b6e037d6077978320` passed GitHub Actions Local PWA quality run **41195575429** in 9m30s. The subsequent QA PWA cleanup fix at `6a7ac8fe596795599e54510f7f2d31b8dfd0a4bc` passed complete clean-checkout run **41197340797** in 10m53s, covering core/build/acceptance, review/offline calculation, tools/MCP/Markdown, device/settings, editorial/iOS handoff, app update, offline and installed-PWA gates. Local verification for the product state passed root 246/246, submission 85/85 and `npm run test:agent-coordinator`; the exact named-note route has deterministic coverage and one post-fix offline Q8 product flow through answer, citation and reviewed save. These are PC/CI findings only.

Earlier source commit `1e2314b77f5842fe2c13008a2f4aefc191d82767` passed complete clean-checkout CI run **41202048972**, attempt 2, in 10m31s. Attempt 1 hit one timeout while a Settings menu item detached during navigation; the same focused settings test passed five consecutive PC runs, then the complete CI rerun passed every stage. This is a transient UI-test race signal, not evidence that the timeout can never recur.

Latest QA cleanup commit `873f5a75292ca5b0d54830cf4ad7fb5efebbebde` passed complete clean-checkout CI run **41205041282** in 10m37s, including the installed-PWA acceptance stage. The user confirms the removed Desktop `Memory` shortcuts were created during this BabelShelf work; the exact individual QA run cannot be attributed from the deleted links. The current cleanup unregisters a QA-installed PWA after an install attempt and removes only links that point to the active or specifically named QA profiles, preserving unrelated Chrome profiles and their data. The focused path-ownership regression passes 6/6; no BabelShelf shortcut is currently present on the Desktop.

Follow-up commit `0e29059f33a632b4fc9cd14f0f189d5dd9aba264` passed complete clean-checkout CI run **41205898103** in 10m45s. This validates the QA cleanup CI record and the current code state; the docs-only correction below is separate.

Documentation correction commit `9091e06d96dcb8724d3203dc42528eab98394190` passed complete clean-checkout CI run **41206782859** in 8m06s. This includes all staged acceptance gates; it does not change code or close the remaining runtime/device gates.

Documentation follow-up commit `b38b2a2f235c4de23c21518b6020dbaf32bce55e` passed complete clean-checkout CI run **41207444882** in 8m29s. The installed-PWA acceptance log records `appUninstalled: true` after offline standalone checks; this verifies the QA registration cleanup path in CI, not the historical origin of shortcuts previously removed from the user's desktop.

Manual file edits now enter `KnowledgeStore.saveFileEdit`, which performs an IndexedDB compare-and-swap against the expected revision and routes through canonical path/managed-file rules while preserving prior body and path history. This removes the UI's storage-wide write diff. Harness profiles now optionally cap cumulative generated tokens and text-generation wall time across every text generation in one Send; fresh defaults are unlimited, and known older profile records gain null limits in memory without rewriting stored bytes. A focused Send integration proves a second generation is narrowed to the remaining token allowance and a third is refused without saving an answer. The time cap interrupts the active text engine with `stop()` and reports a typed budget boundary; it does not count model loading, token counting or tool execution. The runtime must report `outputTokens` for precise accounting; if it omits that metric, the wrapper conservatively charges the call's requested output allowance, including for failed calls. The 128-event limit is only for inline `turn.activity`; the normal production route stores later audit receipts in transactional IndexedDB pages, so it does not derive a 29-call ceiling from the inline limit. A controlled submission test crosses that boundary with 70 distinct searches; live-model long-sequence behavior and actual storage-quota failure remain open. The build retains an existing chunk-size advisory. Broad live-model grounding quality, semantic entailment guarantees, actual iPhone/Android inference and cold-offline operation, full compiled-runtime redistribution review, and public-build adoption remain open. Pre-existing untracked QA artifacts remain untouched. See the [acceptance matrix](MVP-ACCEPTANCE.md); this is not release-complete.

- **Agent contract:** native function instructions and legacy JSON routing are separate, with shared host/source/review checks. Prior dialogue keeps its user/assistant roles. An exact enabled custom-tool ID named in the current request prepares its current guide through the existing audited read operation; it does not execute the package. Unknown IDs use discovery. After accepted guide retrieval, the model receives the callable schema and chooses the next operation. Duplicate pending-execution reminders were removed. Native LFM3 reasoning stays transient and uses the selected output/context budget instead of the short visible-answer style cap. Repeated-character degeneration aborts the stream and invalidates prompt reuse. Source review now highlights the exact selected citation phrase when it has one unambiguous location within the verified excerpt; repeated phrases retain the full excerpt rather than inventing a location. Citation consistency rejects some unsupported/contradictory Japanese and English claims; explicit verbatim quote requests also require the full relevant source sentence, including Japanese requests. These bounded lexical checks do not establish general claim-level entailment.
- **Model route disclosure:** the custom-model picker and `selectedModel.backend` label the registered adapter mapping as a configured route, separately from execution status. After an explicit local model diagnostic, `modelGeneration.loadMetrics.executionBackend` records the runtime-reported execution backend when that runtime supplies it, including a CPU fallback. Desktop LFM3 `auto` retries CPU/WASM after a typed WebGPU model-load failure only after runtime cleanup is confirmed; mobile LFM3 uses strict WebGPU and does not retry on CPU. Arbitrary setup errors and unconfirmed cleanup do not trigger a second load. If CPU/WASM preflight or loading also fails, both route failures remain attached to the surfaced error rather than being hidden. The UI reports the fallback attempt, and the completed load records the actual backend. Bounded runtime-reported layer counts can provide evidence of offload, but do not identify a physical adapter/Metal device or independently validate the runtime's claim. These fields distinguish a requested WebGPU route from a runtime-reported CPU fallback; they do not establish model memory fit or guarantee sustained performance. The built-in LFM3 hint therefore says “Configured route: WebGPU first” and keeps CPU fallback/device execution limits visible. Actual iPhone model fit and sustained behavior remain unverified.
- **Settings migration:** current preference schema is v3. Known v0/v1/v2 records are projected to the current shape in memory; reading them does not rewrite persisted bytes. Only older schemas receive recognized default-value projections, so explicit current-schema values that match a former factory default remain user choices. The historical schema-1 Standard default from the 3-tool/3-call era is now detected only by an exact fingerprint and offered as a reviewed correction; custom Standard profiles and current-schema values are left alone. Approval uses the ordinary version check, revision history and Undo. Other implicit schema projections remain in-memory until a user saves a setting. Present invalid values and future schema versions remain errors. The Playwright migration flow verifies legacy role/model selection and stored bytes/revision count survive reload, then verifies explicit registration appends a revision. Deployed real-user backups from every app build have not been exhaustively sampled.
- **Actual PC evidence:** after network-emulated offline reload, current Q8 completed a guide-only Japanese explanation with one guide read, no package execution and no write. A separate explicit execution request then completed guide read → real user.read-pair → Japanese comparison. Correct locations, 17/9 liters, absent gathering time, two original v1/range 0..37 citations, no repair/repeat or unsolicited save. Both citation buttons opened the correct originals; Save note review contained the exact answer and two sources. Cancelled this review to avoid a duplicate fixture. Committed save and saved-source navigation were verified on prior f7756bfc3e388dab. That earlier model run leaked internal S1/S2 labels in prose and overstated the read tool's role. Current code rejects internal labels in terminal prose and permits one content-only retry; live retry quality remains unverified. A later Q8 run loaded the model but returned insufficient evidence for a question naming its saved note ID; investigation showed the fixture had been created with `Remember` without the required colon, so the malformed note did not contain the claimed fact. The ID-aware selector now has deterministic retrieval/citation tests. A corrected post-fix run used the normal Memory file form to create an exact source, restarted the updated app with browser networking disabled, loaded persisted Q8 assets, generated “Exactly 24 litres.” for an exact named-file question, opened the citation to verify the original sentence, and saved the unchanged answer through the review form. No external request occurred. Evidence is in the isolated profile `babelshelf-q8-postfix-final-343530f/resume-evidence.json`; this is one Windows PC Chrome flow, not broad quality or phone evidence. Earlier failures remain in the history.
- **Performance:** pinned native runtime suffix -checkpoints-2 keeps bounded recurrent checkpoints, including early shared prefixes. Same-input Q4 long-catalog test reused768tokens and reduced prefill103.58s→86.96s (16.0%) and total105.80s→89.81s (15.1%) in that sample. Current Q8 comparison used two model generations:2980/3417input,98/1039output,128/2048cached; aggregate prefill75.92s and generation193.10s, final decode9.69tokens/s. Guide-only generation took208.29s after about31s load. Reasoning improves these observed decisions but adds decode latency; the current product flow is not faster than every earlier flow. Different step counts/outputs are not a matched model benchmark. Runtime25/25GPU-layer logs do not establish adapter identity, peak memory, phone fit or thermal stability.
- **Checks:** on commit `6986b28d05cbed9e9a08578d57d00bb8fe38cf13`, the Windows Settings UI suite passed 16/16, the focused legacy tool-limit review passed 2/2, `npm run check` passed, production build verified 163 assets, and product acceptance passed 8/8. Clean-checkout CI **41248968672** then passed every staged gate in 10m26s. These PC/CI checks do not establish physical network isolation, iOS Home Screen behavior, actual model generation offline or phone acceptance. See the dated [TEST-RESULTS.txt](TEST-RESULTS.txt).
- **Scope and organization:** offline QA removes only the temporary profile/output paths it generated; explicit evidence paths remain caller-owned. Installed-PWA QA unregisters its OS-level test app after success and failure, and removes QA-owned links from Desktop plus Chrome/Chromium Start Menu app folders. Shortcut cleanup recognizes the exact active profile, generated UUID profiles (even if an interrupted QA profile itself remains), the legacy `BabelShelf-lfm230-<32 hex>` QA profile, and numbered unit-test fixtures; an arbitrary `babelshelf-*` Temp profile is preserved. It deletes only shortcut files and never the referenced profile data. A Windows audit removed 134 historical QA-only `Memory` shortcuts after validating each target profile argument; post-run Desktop/Start Menu scan found zero matching links, and the installed-PWA acceptance passes with `appUninstalled: true`. No BabelShelf shortcut remains on the Desktop. Historical QA temporary directories still include browser profiles, local model caches, and evidence output; the 2026-11-01 name-based inventory found 742 direct BabelShelf-named Temp directories totaling 35,001,050,772 bytes by summed descendant file lengths. This is logical file size, not verified physical disk use; no profile, model cache, evidence, or unrelated untracked QA data was deleted. Prototype chunk611.96kB remains.

## Next acceptance task

The post-fix Q8 named-note offline answer/citation/reviewed-save flow and one longer clean-dialogue offline Q8 flow are recorded above. The earlier invalid-answer result came from the same QA profile while it contained synthetic prior turns; after preserving notes/model assets and resetting only that synthetic dialogue, a detailed answer, exact original citation, and reviewed unchanged save all passed on Windows PC Chrome. This remains one PC sample; GPU adapter use, phone compatibility, physical offline operation, long-run performance, contradictory-evidence handling and ordinary tool discovery remain open. Inspect Activity and terminal payloads when extending live-model checks before changing retry, validation, or tool-loop policy. Prioritize cold prefill and reasoning latency under matched request/context conditions while preserving requested answer detail and exact citation checks. Verify that a live model responds correctly to the bounded internal-label repair, with exact source identity retained; never silently rewrite saved answer bytes. Do not add another retry/prompt layer without a distinct demonstrated failure. Keep failures in the same evidence file and reuse existing fixtures. Exact-artifact delivery review and PC preflight precede one targeted device run.

## Open gates

- **Real model and grounding:** Q4 has a passing offline grounded-answer/citation/save flow. Q8 initially failed named-saved-note retrieval on 2026-10-31; after fixing the discarded note-ID selector, one isolated Windows Chrome offline flow returned the exact named-note answer, opened the original citation, and saved the unchanged answer through review (`%TEMP%\\babelshelf-q8-postfix-final-343530f\\resume-evidence.json`). This is one PC sample, not broad quality, GPU-placement, or phone evidence. Extend real-model checks to longer/missing/contradictory evidence and requested detail. Test Q4/Q8 quality and performance under matching conditions, warm reuse, Stop/retry and model switching. Valid citations alone do not prove that the generated claims follow from them. Deterministic guards reject some contradictory water quantities, direct cited water/fuel confusion, named-note quantity mismatches, explicitly titled multi-note amount swaps (including when the prompt refers to sources generically), and unsupported proximity comparisons; direct distance comparisons require exact normalized place identity without automatic article or substring aliases. English prose-comma clauses, grouped numeric commas, and mixed-title value segments are handled for this narrow water-value check. Ambiguous bindings fail closed. These remain narrow pattern checks, not general semantic entailment or general multi-source entity/value matching. This follow-up has deterministic and product acceptance coverage; live-model response behavior remains unverified.
- **Runtime and devices:** complete Wllama/llama.cpp/Emscripten/Dawn compiled-dependency and redistribution review. Text routing is capability-driven across phone and desktop: WebGPU is requested first, with a single browser-default adapter retry when the high-performance hint is unavailable; CPU/WASM remains available for routes that register it. LFM3 desktop `auto` permits CPU/WASM fallback after typed WebGPU unavailability or model-load failure, with cleanup confirmed before retry; mobile LFM3 selects strict WebGPU. Arbitrary setup errors and unconfirmed cleanup do not trigger model fallback. Validate actual GPU placement, load and first-response latency, output speed, memory use and sustained stability. iPhone and Android execution remain unverified; do not equate adapter availability with inference success.
- **Offline:** verify explicit preparation, force-closed installed-PWA cold restart, model generation, imports, source review, saving, and backup/restore under physical device network isolation. PC emulation does not establish iOS Airplane Mode or force-close.
- **Agent and tools:** validate live-model multi-step tool selection, source provenance, bounded failure/retry and configured prompt handling. New built-in Memory Activity receipts retain source IDs/versions/ranges and counts but omit query/path/title/quote/excerpt text; existing historical receipts remain byte-for-byte unchanged and may contain the older verbose payloads. Activity detail exposes available planner and final-answer inference measurements plus registered-tool receipt intervals; final-answer activity omits answer/citation content. The normal production route pages receipts after the 128 inline-event threshold; a controlled IndexedDB integration test completed 70 distinct search selections, crossed 128 receipts and produced a cited answer. A new isolated fake-indexeddb fault-injection test verifies rollback when receipt writes hit a quota exception before tool start, and verifies a completed operation is not replayed if finish-receipt persistence fails. This is not real-browser storage exhaustion. There is no arbitrary default call limit when the profile limit is unset, but an optional user-profile limit, cumulative per-Send text-generation token/time budgets, context/source capacity, cancellation, result bounds and no-progress checks remain. The generation limits default to unlimited; live-model behavior when either configured limit is reached remains unverified. Storage quota/persistence failure can also end work, and actual quota failure is unverified. Custom tools currently use constrained local read-only/compute capabilities; external MCP transport is not established.
- **Data and UX:** preserve original content, IDs, revisions, attachments, conflict checks and approval contracts. Final prompts discourage internal tool names and record metadata in ordinary prose; host validation now detects protocol-shaped leakage and allows one answer-only rewrite against unchanged evidence. Tests verify citation identity and literal quotations survive; explicit implementation questions remain answerable. Live-model correction quality still needs confirmation. Verify binary-original backup/restore and touch navigation on device. Review navigation, preparation, diagnostics and accessibility as real user flows.
- **Delivery:** current GitHub and public Site build are verified for v334. Continue with the remaining runtime distribution review and physical-device gates; confirm active build without clearing user storage.

2026-11-01: Added optional cumulative text-generation token and wall-time budgets per Send in commit `e375dd0357b4679a957e1fd62f58193286cd6bdb`. Defaults remain unlimited. Legacy schema-2 profiles are projected without rewriting their stored bytes; the Settings panel and proposal review display limits. Local PC checks passed: root 250/250, prototype 1,676/1,676, Settings UI 16/16, custom-tool runtime/UI 38/38, production shell 163 verified assets and app acceptance 8/8. Clean-checkout GitHub Actions run [41282977095](https://github.com/Unjuno/babelshelf/actions/runs/41282977095) passed all workflow stages in 9m41s. No model files were downloaded and no public deployment was made. This verifies configured budget accounting and release packaging on PC/CI; real-model limit-hit behavior, iPhone/Android behavior and physical offline execution remain unverified.

2026-11-02: Commit `d38922b` coalesces streamed answer-preview state to the browser animation frame, limiting presentation updates to display cadence and discarding pending previews on Stop or terminal outcomes. Submission-controller tests pass 11/11; `npm run check` and the production build pass. Clean-checkout GitHub Actions run [41391802693](https://github.com/Unjuno/babelshelf/actions/runs/41391802693) passed every workflow stage in 10m38s. This reduces UI update work; it does not claim faster model decoding. Existing Windows evidence confirms all 25/25 LFM3 layers offloaded in the pinned Chrome runtime and shows a short prompt-prefix reuse win; iPhone, Android and macOS matched performance remain unmeasured. No device-specific batch or thread tuning was inferred from that PC run.

2026-11-02: The one-button Developer report includes the selected model's registered context limit, bounded to 1–262,144 tokens, and the Wllama runtime's standard/compatibility WASM resource choice. Settings labels context as configured metadata and resource mode as runtime metadata; neither claims allocated memory or GPU use. Both values pass through the safe one-tap diagnostic handoff. Related diagnostic, report-copy and runtime tests, the 25-case Developer UI suite, `npm run check`, and production build passed locally. Clean-checkout CI [41402864271](https://github.com/Unjuno/babelshelf/actions/runs/41402864271) passed every stage. A local attempt to serve the experimental benchmark page was intercepted by the existing app service worker; no bypass was attempted and existing browser storage was not changed. This improves measurement/reporting support, not GPU speed; matched on-device runs and runtime memory/thermal evidence remain open.

2026-11-02: The CI rerun for `60be588` reached the existing GPU-fallback UI assertion and failed because the text locator resolved a hidden node. The regression now scopes the assertion to the visible fallback row inside Device test and checks its explanation text. The targeted test passed; all 26 built-app handoff tests passed in Chromium and all 26 passed in WebKit. Clean-checkout GitHub Actions run [41433270271](https://github.com/Unjuno/babelshelf/actions/runs/41433270271) passed every workflow stage for follow-up commit `16adc36`. This is test-selector robustness, not a runtime or speed change.

## Evidence location

Dated runs and the exact prior status document are preserved in [TEST-RESULTS.txt](TEST-RESULTS.txt). The prior status snapshot has SHA-256 8637016ccf264fc474c89ea9e25864fb8e773d3eebe20f4fae3e53071637695b. Search it by build or feature; add detailed runs there, and keep this file limited to current state and unresolved gates. Runtime-specific findings remain in [LFM3-RUNTIME-SPIKE.md](LFM3-RUNTIME-SPIKE.md).

2026-11-01: Clean-checkout GitHub Actions run **41233232875** passed every stage on commit 61c45394a25ea1b3c0d3d361363eb727e158961d in 10m59s. Core/build/acceptance, review/offline calculation, tools/MCP/Markdown, device memory/inference/schedule/settings, editorial/iOS handoff, and app-update/offline/installed-PWA acceptance all passed. This verifies the named-note citation guard in clean CI, not live-model response quality, physical iPhone/Android inference, or real-device offline cold restart.

2026-11-01: A two-note comparison could cite both originals yet swap their water quantities in prose. Added a conservative claim-binding check that associates an amount with a note only when the question and answer both contain that note's exact title and the amount has one unique nearest title in the same sentence. It refuses overlapping-title and equal-distance cases rather than guessing. English and Japanese regressions exercise both the checker and the actual groundedAnswer route; unlabeled multi-value answers retain the existing aggregate behavior. Focused answer/conversation tests passed 205/205, the full prototype suite passed 1,656/1,656, TypeScript and npm run check passed, product shell 6952bcbb06e7dddc verified 163 assets, and product acceptance passed 8/8. GitHub Actions Local PWA quality run 41235492468 passed every clean-checkout workflow stage on Ubuntu in 10m59s for commit 7dce0e33a033fd7a61cb814bde67af17c2cfe942. This does not solve general multi-source entity/value assignment or semantic entailment.

WebGPU selection follow-up (2026-11-02): runtime adapter preference installation is now idempotent, and bounded capability checks call the underlying adapter method directly so there is one high-performance request and at most one browser-default retry. Stop prevents a pending probe from starting its fallback request. Controlled tests cover null/rejected adapter results, original receiver/options, repeated installation and abort. Root 256/256, prototype 1,821/1,821, static check, 165-asset production build and app acceptance 8/8 passed locally. This reduces avoidable setup work on retry paths; generation speed on the primary-adapter-success path is unchanged. Windows/macOS/iPhone/Android matched model runs remain open.

WebGPU adapter retry CI follow-up (2026-11-03 JST): clean-checkout Actions [41465845149](https://github.com/Unjuno/babelshelf/actions/runs/41465845149) passed every workflow stage for `a2ee09c`. This verifies the deduplicated preferred/default adapter selection in CI and packaging, not GPU inference speed. Windows/Mac/iPhone/Android matched model runs remain open. The Windows host identified for a future run is i7-1250U / Intel Iris Xe / Windows 11; these hardware identifiers do not establish browser-selected adapter, actual offload, or speed. No local test server was running and the existing side-browser control endpoint was unavailable, so no model was launched and browser state was left unchanged.

WebGPU late-response regression follow-up (2026-11-03 JST): clean-checkout Actions [41471192540](https://github.com/Unjuno/babelshelf/actions/runs/41471192540) passed all workflow stages for `2e219fb`, including model/runtime packaging, device diagnostics and inference acceptance, iOS handoff, and offline installed-PWA acceptance. This validates the preflight cancellation contract in CI. It does not demonstrate faster inference or platform compatibility/performance; matched real-model runs on Windows, macOS, iPhone and Android remain open.

Answer identity-leak follow-up (2026-11-03 JST): final-answer validation now rejects the exact host-bound Memory record ID when a model includes it in ordinary prose, including managed slugs such as `settings-harness` that the UUID-only detector could not recognize. It allows IDs explicitly present in the current request, literal cited source text, and distinct near-match identifiers. Citation binding, evidence bytes and answer text are otherwise unchanged. Focused agent-evidence tests passed 29/29; full prototype tests 1,822/1,822; `npm run check`, production build and product acceptance 8/8 passed. This reduces user-visible implementation leakage; real-model compliance and answer-repair behavior remain unverified.

Clean-checkout GitHub Actions [41473834084](https://github.com/Unjuno/babelshelf/actions/runs/41473834084) passed every workflow stage on commit `4e11c00b57b67159a6234dbb06e757b0d43f08ca` in 10m36s. This confirms the new answer validator and packaging across the repository CI matrix; it does not establish live-model compliance or platform performance.


2026-11-03: New-note proposals now persist as bounded inert review data while the editor is open or closed. Save revalidates the exact pending snapshot and commits the reviewed note plus pending-review removal in one IndexedDB transaction; Discard is compare-and-delete, and backup/restore labels the entry as “Pending note”. Prototype suite 1,826/1,826, targeted note review/creation 12/12, `npm run check`, and the 165-asset production build passed on Windows. This improves interrupted-review recovery and does not grant model write authority. Device-specific GPU tuning remains deferred until matched real-runtime runs are collected; see INFERENCE-OPTIMIZATION.md.

WebGPU diagnostic failure classification follow-up (2026-11-03 JST): Developer reports now distinguish a confirmed missing adapter from probe failure and timeout, use the inference preflight's abortable bounded request, and prevent a late probe from triggering an extra fallback request. Legacy schema-1 reports remain readable. Focused diagnostics tests (39/39), root tests (257/257), prototype tests (1,841/1,841), `npm run check`, 165-asset production build, app acceptance (8/8), and targeted browser diagnostics (27/27) passed locally. Clean-checkout Actions [41539032548](https://github.com/Unjuno/babelshelf/actions/runs/41539032548) passed every stage in 11m9s. The current Windows host reports Core i7-1250U / Intel Iris Xe; this identifies the test host only. This run does not measure model speed, prove actual WebGPU inference, or establish iPhone/Android/macOS compatibility. The in-app browser control endpoint was unavailable in this session, so no live model diagnostic was started and no browser storage was touched.

Developer report handoff follow-up (2026-11-03 JST): the copy-to-Codex guidance now stays platform-neutral and describes offline/force-close evidence according to the reported environment, so a Windows speed sample no longer receives iOS-only instructions. The report remains bounded and excludes prompts, notes, original files, and answer text. Focused report tests passed 14/14, root tests 258/258, prototype tests 1,844/1,844, `npm run check` passed, the production shell verified 165 assets, and product acceptance passed 8/8. No model was loaded and no live performance values were added; Windows model performance still requires a report from Settings → Developer → Performance → Run speed sample.
