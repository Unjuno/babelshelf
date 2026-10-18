# Decision model candidates and current status

Status audited 2026-10-18. The original candidate research led to an optional local Open d1 Omni 600M text-decision adapter. It is integrated and has real PC inference evidence; it is not an unimplemented candidate. See [DECISION-CONTRACT.md](DECISION-CONTRACT.md) and Units20–22 in [TEST-RESULTS.txt](TEST-RESULTS.txt).

## Connected model

Only `d1-omni-600M` has a bounded text adapter. It is a separate role from Bonsai: it emits calibrated typed choices for current-request routing, not prose answers, citations, edits, or permissions. Registration, prepared assets, verified readiness, and loaded state remain distinct. The optional Decision role may be unset; ordinary work does not acquire its assets unless the user explicitly prepares them.

The implementation pins LiquidAI/d1-omni-600M revision `02b55d7076f15129e59ab3f94783f32c4b088674`, ONNX conversion revision `4ebc1b97bf1477485371c79d1cf8d5e4e8eebfa0`, six files totaling 411,075,809 bytes, and a separate ONNX Runtime Web package. Model/adapted prompt-readout terms are LFM Open License 1.0; ONNX Runtime Web is MIT with third-party notices. Neither license is inherited by the other. Exact pins, lifecycle, and role limits are maintained in the manifest and DECISION-CONTRACT.

Actual PC samples show that local D1 can load and classify bounded current-only requests, including an offline cached run. They do not establish broad classification accuracy, Japanese quality, useful phone latency, or mobile resource fit. Unit21 retains a real summary-content miss (the summary omitted a reserve quantity) and an invalid Bonsai planner result after a structured request deferred. D1 remains an optional routing aid; source resolution, contextual queries, corrections, schedules, and answer generation keep their existing Bonsai and deterministic validation paths.

## Unconnected candidates and capability limits

`d1-3B` remains selectable in the catalog but has no connected runtime adapter; the UI must report that boundary explicitly. Preparing the 600M text graph does not install its image or audio encoders. The “Omni” name does not establish OCR, transcription, video understanding, simultaneous image/audio input, or general visual reasoning. Image text and speech recognition remain separate locally prepared pipelines.

The official sources reviewed for the original proposal are [Liquid AI’s Open d1 announcement](https://www.liquid.ai/blog/d1-open), [d1-omni-600M](https://huggingface.co/LiquidAI/d1-omni-600M), and [d1-3B](https://huggingface.co/LiquidAI/d1-3B). The announced model is a research checkpoint. Its advertised audio/image behavior is not product capability evidence. Do not use these candidate descriptions to silently select another model or send content to an API.

## Remaining verification

The decision adapter still needs current-build installed-PWA cold-offline lifecycle verification, Android/iPhone resource and latency checks, broader Japanese/ambiguous-intent evaluation, and clear capability behavior when missing or unprepared. `d1-3B` compatibility/license/assets and true Omni modality support require separate evidence before implementation. No cloud, LAN, PC-serving, or alternate-provider inference path is authorized.
