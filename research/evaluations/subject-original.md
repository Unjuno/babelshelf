# Original speaker binding — Unit31

## Evidence before integration

Unit29 reproduced wrong source selection with the same pinned4B in the official reference; Unit30's2B failed different required controls. Another engine/default-model switch is unsupported. The recurring native failure selects an old USER split instruction and applies a valid literal tool to it, rather than using the latest ASSISTANT code answer.

On native productbefd36343feda27d, five actual4B greedy/non-thinking/resetSession public comparisons use a short current-request-last prompt and two exact candidate originals, no summary or source-reference metadata. Outputs are finite A/B/none and remain Observed/pass=null. Exact fixture/report: subject-original-comparison.json / subject-original-befd36343feda27d.json.

| Request | Proposed A | Latest B | Actual model choice | Interpretation |
| --- | --- | --- | --- | --- |
| Japanese that-code split | old user split request | assistant code | B | Required competing-speaker choice |
| First user code read | first user code statement | assistant code | A | Preserves explicit user original |
| Fourteenth user instruction itself | old user split request | assistant code | A | Preserves explicit numbered user original |
| Assistant before latest | older assistant code | latest assistant code | B | **Wrong; broad temporal re-resolver rejected** |
| English that-code split | old user split request | assistant code | B | Required competing-speaker choice |

The integration therefore does NOT reselect arbitrary indexed sources. It implements only cross-speaker binding for indexed recall/transform when the planner proposed a USER original and an exact latest ASSISTANT answer exists. Assistant-to-assistant chronology stays planner-owned; capture bypasses. This avoids the measured broader regression. It does not establish correct chronological selection or universal intent accuracy, and does not erase the failed raw output.

## Control contract

`dialogue-subject.ts` projects candidates to index/speaker/exact text. Current request is its own final literal user message. Actual tokenizer count plus64output must fit the2048 context. No candidate truncation, generated source text, expected-target replacement, body fallback or write/network permission. A/B maps only to the supplied immutable original objects. Unknown fields, malformed JSON and none refuse; raw bounded invalid output is retained as audit evidence. Stop is checked before and after awaits. Same-speaker/no-latest cases keep the original without another model call.

The UI audits both candidate reads and a separate `dialogue.subject` step, then pins final `readTurn`, refs, text.inspect and deterministic literal receipt to the SAME chosen original. Planner output remains separately auditable. No extra generation or changed bytes on capture/Save. Activities stay out of model history and execution authority. Two speaker control tests and one raw audit failure test went Red then Green; independent46-focused/source-extracted dispatch review found no Important control defect, including Stop/CAS during terminal persistence. Control doubles are not model acceptance.

`node research/verify-subject.mjs` verifies retained pins/input/message identity and replays actual raw choices through the production guard. It explicitly retains the wrong broad older-assistant choice and the production bypass; it runs no inference and proves no native ordinary-context success.

## Native integration gate

Product6175aef41bab4fb2/index-4dQk9jYO,96verified assets, main520.64kB; protected prototype731.70kB. Existing size warnings remain. Normal verified update/reopen, DownloadsOFF, both normal models unloaded before owned-tab networkoffline+reload. Existing84turns/81notes retained. At first the Send button remained disabled during startup checks; no turn was submitted then. Once controls became ready the SAME two Japanese requests were submitted normally.

1. First-user-code request: actual4B/D1 local load -> planner recall0/user -> reads original0 and latest83 -> subject A -> inspector read -> actual answer `LILAC-7319`. No note automatically saved. About138.022s summed activity, including45.692s text load,12.180s D1 load,47.998s planner,10.472s speaker binding,8.753s inspection and10.610s answer. This latency is material and excludes some UI/startup time.
2. Exact follow-up `そのコードを、ハイフンの前と後に分けて二行だけで返して。`: planner STILL chooses wrong old14/user and even proposes the old instruction in body. Exact reads contain A old14 instruction and B latest84 `LILAC-7319`. **Actual subject model chooses B**. readTurn/refs/text.inspect/literal receipt all target turn84 assistant. Inspector selects split_lines delimiter `-`, matches1. The application applies that actual operation to the chosen original -> exact `LILAC\n7319`, with no generated replacement or knowledge-answer fallback. About49.385s summed activity: planner34.156s, subject7.522s, inspector7.193s. Both real decisions and deterministic execution are visible in on-demand Activity. Screenshots `outputs/native-subject-split.png` outside Git are PC360x780 emulation, not an iPhone.
3. Save note opens the existing two-line answer in review. Exact textarea bytes confirmed, filename `QA1704-subject-split`, explicit Save -> canonical `Inbox/QA1704-subject-split.md` v1, generated/empty sources. No regeneration; ordinary Save note leaves working answer refs empty. This unsourced generated file does not become external factual evidence. After explicit model unload, document reload and same-file restore, Memory Find files locates that path and opens the same v1 content.

Both models explicitly Unload, still-tab-offline document reload, export59 -> reviewed Restore82records33originals -> re-export60 strictly equal notes/settings/runs, SHA-256 `f50671a684a52cef7c6667cd5c419312b0603645a773a008f4c4e71b726439e3`.82notes/3auxiliary settings/109runs/33originals/all86turns. Full original84turn prefix, every prior note/revision/run and other auxiliary record unchanged except explicit append-only Connection update toggles. Compaction exactly unchanged through78/summary594chars: this trial did NOT trigger another compaction. Only the reviewed new generated note, two new dialogue turns and two explicit Unload receipts were added; no new raw original or task execution. Wrapper verify-subject-native.mjs outside Git checks full records/source/operation identity/exact new-note bytes and strict restored state. Same-file restore may skip existing records, not fresh-device recovery proof.

Owned network/viewport emulation reset, diagnostic45 closed, normal models unloaded/DownloadsOFF, server4180 live. Fresh baseline44/prototype194/product2/Markdown4/check24/protected28/TypeScript/product+prototype builds pass. No runtime/model/reader pins, accepted UI, provider, license, cache policy or original-state changes; no push/deploy. This repairs the demonstrated competing-speaker flow on PC, not universal chronology/intent accuracy, numerical equivalence, full-process offline restart or physical-device acceptance. Typed settings/tools, broader media/custom/archive/storage/device gates remain in the whole goal.
