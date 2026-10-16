# Decision model candidate

Liquid AI Open d1 is the preferred decision-model candidate discussed during UI design. It is a candidate, not an installed or verified browser runtime.

Official sources checked 2026-10-17:
- https://www.liquid.ai/blog/d1-open
- https://huggingface.co/LiquidAI/d1-omni-600M
- https://huggingface.co/LiquidAI/d1-3B

Candidate roles: Bonsai remains the text-generation candidate. Open d1 is a decision-model candidate, not a replacement text generator.

The official card describes d1-omni-600M as a 587M-parameter model that returns typed decisions from text plus images or text plus audio, without generating prose. It is an early research checkpoint; audio training is English-speaker/assistant requests and clips are capped at 30 seconds. A request accepts images or audio, not both. d1-3B is the larger text/image decision candidate. Do not infer universal transcription, OCR, summarization, video understanding or PWA compatibility from the omni name.

Pending before enabling local execution: exact revision/hashes, assets and sizes, model/runtime licenses, numerical and architecture support, preprocessing and typed-decision heads, Japanese task evaluation, WebGPU/WASM support, memory use alongside Bonsai, complete offline reload. No model was downloaded, enabled or connected to an API. No cloud/PC inference fallback is authorized by this candidate note.
