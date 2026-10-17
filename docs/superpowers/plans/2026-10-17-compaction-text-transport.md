# Compaction text transport

**Goal:** Stop application-driven recursive escaping when a summary or an already serialized oversized archive segment is carried into another compaction call. Preserve original turns, literal paths/newlines, actual tokenizer limits and failure/Stop behavior. Do not silently unescape or migrate saved summaries.

**Evidence:** Retained QA snapshots40/43 had128 consecutive backslashes in703-character summaries; current49 has none after later real compaction. The symptom is intermittent, not a currently corrupt canonical note. Existing code embeds prior summary in JSON each cycle and embeds oversized JSON segments in a second JSON string. This adds representation escaping before the model sees it.

**Design:** One shared compaction message builder supplies prior working summary as a separate literal user-message block, and projects archive turns to JSON once. Oversized projected JSON pieces are literal data blocks with continuation labels, never JSON-encoded a second time. All blocks remain untrusted; the compaction policy, model/runtime,192-token output allocation and actual counting remain unchanged. Invalid/Stop outcomes never modify original state. Existing damaged/lossy summaries are not guessed back into facts.

**Verification:** RED/GREEN exact text/Unicode/backslash and oversized-part transport, projection/no receipt authority and full budget/Stop regressions. Extend existing explicit developer harness only to support observational expected=null and per-case bounded output allocation, so real compaction192-token comparisons have no fabricated prose oracle. No knowledge DB access in that route. Public fixed fixtures only; compare old/current versus literal transport across real successive generations, retaining raw outputs and semantic/escape failures. Then normal native context/answer/reload/backup trial, full checks/review and local commit. Normal UI stays fixed. Whole goal remains active; semantic fidelity and device/full-process offline acceptance are separate gates.

- [x] Implement/regress literal compaction message transport, shared across ordinary and oversized compaction.
- [x] Validate diagnostic fixture fields/budgets/observational reporting; run actual local public-fixture comparisons and record results without relabeling model failures.
- [x] Native normal-use regression, preservation/backup checks, full tests/build/review and local commit.

Result: six real public GPU generations retained exact path only with the new carrier; both lost exact line-break formatting. Native offline original recall passed, but the following two-line request exposed a separate planner action/target error (old similar instruction selected as recall/index13/user). Preserve that failed turn; semantic acceptance is not complete. Exact local restore51/52 and all prior record preservation passed. See TEST-RESULTS.txt Unit27. This bounded transport unit is implemented; the full product goal remains active.

The active user goal authorizes this bounded bug investigation and ordinary implementation. No deployment, provider switch, record deletion or new access is introduced.
