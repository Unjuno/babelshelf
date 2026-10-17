# Harness-owned current result

Latest user direction supersedes Unit31 model-specific subject rescue. Keep accepted UI and all originals.

Implement a persisted stable turn-ID pointer to the current completed assistant result, atomically with dialogue completion. Legacy dialogue derives the pointer without rewriting history. Compaction, failed turns and audit updates do not change it. Expose only its identity to planning; resolve exact original bytes at execution.

Typed dialogue targets distinguish current result from explicit historical index/speaker. Current must not carry competing history fields. Reject invalid targets rather than correcting model output. Ordinary indexed operations no longer invoke the Unit31 A/B model re-resolver. Capture reuses original bytes and sources in existing review. Keep historical receipts readable.

Verify state/legacy/compaction/failure/backup and planner contract using control tests, run baseline and product checks/build, then inspect real browser integration. Real-model checks are integration evidence, not prompt-variant benchmarking. Physical-device and complete MVP acceptance remain open.

Outcome: implemented current-result persistence/strict target dispatch, removed normal A/B rescue;198 prototype controls and baseline/product/build checks pass. Actual PC a615 cached-model/tab-offline replace/current85 -> exact new result87, reviewed Save, offline document reload/Memory lookup and same-state backup restore verified. Initial portable-JSON defect reproduced and fixed; failed original retained. See Unit32 TEST-RESULTS for limits and artifact locations. Full goal remains active.
