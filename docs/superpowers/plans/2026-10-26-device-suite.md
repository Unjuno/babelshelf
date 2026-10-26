# One-button device test plan

**Goal:** Settings > Developer has one explicit Run tests action and one copyable report.

**Architecture:** A UI-independent suite collects checks once. Installed apps save a baseline and bind one model run to the existing claimed restart continuation. Browser tabs run the prepared selected model locally and do not arm a different Home Screen storage context. Missing/blocked models are not-run, never downloaded or replaced. OS Airplane Mode/close remain manual and unproven.

- [x] Write and observe failing orchestration tests, then implement suite service.
- [x] Replace separate device/model/restart start buttons and model checkbox with Run tests, pending Cancel and existing Copy/Stop.
- [x] Verify browser continuation, interruption, cancellation, report copy and old-marker compatibility.
- [x] Verify local UI/build regressions and document exact PC scope.
