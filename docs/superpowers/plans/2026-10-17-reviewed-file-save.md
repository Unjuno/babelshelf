# Reviewed file commit and acknowledgement

Native two-tab capture reproduction: pageA reviews CHESTNUT3944; pageB completes literal search; pageA Save commits canonical note then fails dialogue CAS, leaving New file open despite saved note. Preserve the other tab's dialogue and saved canonical note; never retry creation automatically.

Add synchronous reviewed-file save exclusion through commit/acknowledgement, lock form fields/tabs/dismissal while saving, and distinguish commit failure (retain draft) from post-commit acknowledgement failure (close review/open saved file, short Saved warning). Pin exact reviewed body/sources and originating turn before awaits; do not regenerate. Keep canonical path/source validation and shared dialogue writer/CAS intact. Block background same-page task claims through the whole operation.

Controlled deferred double-submit/commit/acknowledgement failures, full prototype/TS/build/runtime, actual normal capture and two-tab acknowledgement-conflict UI plus canonical backup comparison. No mock inference/product data reset.
