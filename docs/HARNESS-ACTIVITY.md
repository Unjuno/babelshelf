# Interactive harness activity

Activity is local audit data on each canonical dialogue turn (`ui-v1-dialogue`). It is not a second knowledge store, a tool registration or execution authority. Older turns without activity remain readable; no records are cleared or retrospectively fabricated.

The interactive adapter records allowlisted read-only stages: model load, bounded context/compaction, action selection, note search/read, original dialogue read, literal text operations, correction proposal and answer generation. Existing approved correction writes retain their separate atomic correction receipts; scheduled runs retain their canonical execution ledger. Speech recognition and asset preparation are not yet part of this interactive ledger.

Each attempt stores schema1, a stable ID, operation name, exact bounded JSON input, start timestamp and status. The start commits with expected-dialogue CAS **before** the operation begins. Completion stores a detached result or a typed error and finish timestamp. Terminal entries cannot be completed twice or switched to another input/tool. Tool-returned failures retain both their result receipt and failure status. A failed start prevents execution; a failed final write never repeats the operation or asserts a tool failure after actual success.

A process interruption may leave `running` persisted. Outside that exact active input it is displayed as `Incomplete`: this does not claim the work failed, completed or never ran. There is no automatic replay. Stop retains a stopped attempt when the underlying operation returns/cancels; this does not promise instantaneous cancellation of GPU loading/compilation. Failure to persist a terminal record is shown explicitly and may leave an incomplete entry.

Activity payloads are portable JSON, limited to300,000 UTF-8 bytes each, nesting depth20,128 entries per turn. Invalid operation/status/time/result shapes, duplicate IDs, nonfinite values and cycles reject. Codes distinguish stopped, changed source, context limit, unprepared model, malformed model output, unavailable target and other failures. Messages remain local; error classification is a UI/audit category rather than proof of cause.

Normal conversation shows one small activity mark. The sheet opens short operation/state labels; details expose input/result/error on demand. Activity is explicitly excluded from dialogue history/compaction projection, search evidence and instruction parsing. Backups preserve and validate it as untrusted receipts. A rehashed backup does not convert an unknown operation into a valid one. User data and receipts are never uploaded by this flow.

A note read resolves from the same refreshed snapshot that hydrates its display. Navigation uses its resolved path. This prevents an activity saying a new version was read while an older in-memory list paints a different file/version. This is snapshot consistency, not a claim that another tab can never make a later edit.

Verification scope: pure lifecycle/control tests and real IndexedDB reopen/CAS/brainpack tests are separate from actual browser/model outcomes. Exact builds and observed failures are in TEST-RESULTS.txt. Incomplete activity, older status-only failures and unrelated historical source marks are preserved; this feature does not retroactively repair semantic answers or establish mobile/offline acceptance.
