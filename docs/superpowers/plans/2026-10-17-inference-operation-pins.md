# Inference operation pins

Model-independent harness correction: count/compaction/planning/grounding must retain one loaded model revision, runtime revision, context capacity and cancellation epoch across asynchronous calls. Per-call checks alone miss changes between calls.

Add an optional pin capability to the common local text port, pass it through the approved adapter, and bind each conversation/grounded operation after any explicit prepared-only load. Bound handles cannot load models; nested pins retain the same boundary. No network, storage or write permission is added. Existing plain engine unit controls remain compatible.

Verify failing between-call model-change/Stop controls, unchanged normal operations, full existing suites, product build and an actual offline PC browser storage flow. These unit adapter controls do not represent model generation. No prompt tuning or provider changes.
