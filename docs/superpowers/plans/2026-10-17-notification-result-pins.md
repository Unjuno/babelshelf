# Notifications pin occurrence results

Observed source defect: taskNotice reads current task body and notification Open result resolves current execution body. An edited task or retried occurrence can therefore change the apparent source of an older event.

Use the retained taskRevision for prompt/notify policy, pin new events to exact runRevision and attempt, validate these links in backup and retain legacy unpinned events as explicitly current-result links. Open result projects the exact retained execution body, preserving existing sheet/source/Save behavior; Open file still opens current canonical record and must be labelled as current for a historical result. No new execution permission, background capability, model/provider or UI redesign.

Verify edited-task snapshot, failed/retried historical result selection, missing/tampered pins and backup, legacy fallback, actual foreground failure/retry/notifications if feasible. Existing record revisions and notification IDs remain unchanged.
