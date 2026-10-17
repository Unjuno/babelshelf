# Local text inference boundary

User direction: model-independent harness; preserve accepted UI, local-only execution, approved model/runtime pins, histories and source validation. This bounded extraction keeps existing workflows and worker implementation.

Contract: TextEngine supplies actual tokenizer count and generation; TextRuntime adds loaded identity, local verified assets, explicit prepared-only load and Stop. No preparation/download/network/storage/tools/permission API crosses this boundary. React useBonsai owns the existing worker and exposes a stable adapter over current live state. Conversation, correction, task and grounded-answer consumers use the shared structural contract rather than a React-hook return type.

Boundary rejects invalid token counts, invalid generation shapes, stopped partial output and late results after Stop/model identity change. It preserves exact input messages/output text, does not normalize JSON, invent citations or rescue source selection. Existing orchestration continues to validate scopes, token budgets, approvals, expected-record CAS and provenance. Runtime-specific tokenizer/template/quantization remain within the approved worker.

Verification: control tests cover exact port delegation, no write/download API, Stop/model change during pending generation and invalid port responses; all existing prototype controls and production/prototype TypeScript builds. Actual PC ordinary generation on the resulting build is integration evidence only, not renewed model benchmarking, numerical accuracy or physical-device acceptance. No model registration/runtime interchangeability claim follows from this port alone.
