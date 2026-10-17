# Shared verified application assets

Problem: every app generation retains the same large immutable readers/WASM/fonts. Phone storage grows per update even when binary bytes are identical. Preserve current/historical navigation, old lazy-module URLs, BFCache compatibility, explicit acquisition and every canonical/model store.

Introduce one app-only asset cache keyed by full SHA-256, plus a per-build manifest committed only after every build file verifies. New installs reuse an existing shared response only after hashing its bytes against the new manifest; new/corrupt missing responses require the existing explicit installation fetch and exact size/hash check. Non-fingerprinted shell/license files stay per-build. Current immutable URLs resolve using embedded pins; older shared-aware builds resolve through their exact retained per-build metadata. Existing flat historical caches keep fallback priority and remain untouched.

No pruning or legacy migration in this unit: deleting legacy assets needs separate lifecycle/interruption proof. This bounds duplicate binary growth for future updates but does not reclaim accumulated legacy copies or unique historical JS. Cache namespaces/virtual metadata are app-only and never authorize external requests. Missing data fails503, never fetch-on-demand. Install failure/quota leaves previous generations intact and may leave reusable unreferenced verified pool entries.

Verify two-generation dedup and old lazy module fallback, current shell priority, corrupt shared entry revalidation, install failure, unknown/foreign caches, subpath scope, real native update and server-stopped reload/lazy reader operation. No model inference benchmark or UI redesign.
