# Same-weight CPU reference, 2026-10-17 (Unit29)

The four retained public WebGPU observations were repeated with the **same pinned 4B PTQ1_0 weights** in the official PrismML CPU reference. All four native prompt token counts and observed output strings match, including three instruction/target failures. This is evidence against attributing these particular failures solely to the WebGPU runtime. It is **not numerical parity, broad model acceptance, or a source-selection fix**. No product code, provider, runtime pin, UI or canonical data changed.

## Pins and scope

Official [Bonsai-demo Windows setup](https://github.com/PrismML-Eng/Bonsai-demo/blob/main/setup.ps1) selects [prism-b10777-e3de715](https://github.com/PrismML-Eng/llama.cpp/releases/tag/prism-b10777-e3de715), commit `e3de715222b2667c54a267441159a5729f11155e`. We did not execute its setup script. A portable CPU zip was downloaded, hashed and extracted outside Git; no global installation or server was started.

- Archive: `llama-prism-b10777-e3de715-bin-win-cpu-x64.zip`, 19,530,958 bytes, SHA-256 `cff7eeff19163e6263720618cf98023715b8dac14d0873f5be0918765de323c4`.
- Executable: `llama-completion.exe`, SHA-256 `b828938be7b025ddba50b0d0d7cd64cf53f260667abd118853538e8e791b29c2`.
- App's actual model: 949,549,920 bytes, revision `8d6557168168f91ea6697a4a49ed2ef622b53adb`, SHA-256 `56711263ec9a9ffeaa74a3a0e58dece8127cf9268404746c721113ca76994d60`.
- PC: Windows, Intel i7-1250U, Intel Iris Xe. Reference execution: four CPU threads, GPU offload zero, fresh process per case, offline flag, no server or app connection. Only public fixtures were read. This CLI is diagnostic, never a PWA/PC/LAN inference backend.
- Browser comparison is the previously retained actual WebGPU output, **not a new browser generation in Unit29**. Its manifest runtime remains revision `621e20782f208660f4f58283c2ce58430020f243`, SHA-256 `00c1a72a962a84fee17000a6b1d18b24d75033e56d59996fc504b7c57cfc6488`.

## Actual metadata and rendering

`reference-gguf.py` rehashes the model, parses GGUF metadata with bounded stdlib reads and renders public messages through its actual template using Python3.12/Jinja2 3.1.6 sandbox. It does not load tensor weights or infer. The 7,756-byte template SHA is `a4aee8afcf2e0711942cf848899be66016f8d14a889ff9ede07bca099c28f715`; exact template and rendered prompt bytes are retained. Non-thinking generation: `enable_thinking=false`, `add_generation_prompt=true`, no tools; template provides the empty think prefix. Worker generation and count both use `enable_thinking=false`.

Parsed architecture: qwen35, 32 blocks, hidden 2560, FFN 9216, attention 16 heads/4 KV heads, key/value 256, full attention interval4, linear state128/group16/inner4096. Hadamard metadata: version2, block512, normalized Sylvester Walsh Hadamard, explicit signs, input-last-dimension, grouped GDN values, tied output. Tensor types: 225 F32 and201 PTQ1_0 (143). Tokenizer: gpt2/qwen35, vocab248320, EOS248046, BOS/padding248044, add_bos=false. See retained metadata summary. This run does not exercise PQ2_0 or Q2_0.

Native tokenizer uses special-token parsing and no escape expansion; prompt counts match the retained browser counts. This does **not** compare full token IDs or capture the browser's exact rendered bytes. Equal counts alone are not proof of template equivalence. Reference generation uses context2048, the corresponding original output budget, greedy temp0, neutral repetition/presence/frequency penalties and F32 KV. Browser precision and all internal kernels were not matched numerically; no logit/tensor parity claim follows.

## Results

| Public case | Prompt tokens (both) | Native wall time | Observed output (both) | Semantic interpretation |
| --- | ---: | ---: | --- | --- |
| raw-minimal | 52 | 12.852s | `CEDAR-4826` twice on separate lines | Fails requested split; both preserve the hyphen |
| old-transform | 625 | 119.165s | recall, index13/user, old instruction in query/body | Reproduces wrong action/old target |
| read-tool-operation-read | 219 | 39.465s | `{"action":"read"}` | Correct read selector in this small control |
| relative-split | 167 | 31.497s | `{"target":"latest_user"}` | Wrong subject for requested answer-code transformation |

All four CLI processes exited0. These are observations, **not four quality passes**. Wall times include process/load; they are not a standardized CPU-vs-GPU performance benchmark. Raw stdout/stderr, args, source reports, rendered prompts, hashes, token IDs/counts and results are in [reference-cpu-e3de715](reference-cpu-e3de715/). The CLI writes a presentation-only ` [end of text]` marker plus final newlines: verified in [pinned completion source](https://github.com/PrismML-Eng/llama.cpp/blob/e3de715222b2667c54a267441159a5729f11155e/tools/completion/completion.cpp). The verifier removes only that exact suffix and normalizes Windows CRLF for comparison; raw files remain unchanged.

## Reproduction

Prepare the pinned zip/model in a separate local folder; retain `pins.json` and extract the archive to `cpu-bin/`. Install Jinja2 3.1.6 in a suitable Python environment. From repo root:

```text
python research/reference-gguf.py <base>/Ternary-Bonsai-2-4B-PTQ1_0.gguf . <base>/prompts
node research/reference-run.mjs <base> raw-minimal
node research/reference-run.mjs <base> old-transform
node research/reference-run.mjs <base> read-tool-operation-read
node research/reference-run.mjs <base> relative-split
```

The runner verifies model, prompt, release archive and executable before execution, refuses output overwrite, uses spawn without a shell, and records exact CLI arguments. Token counts/IDs were obtained with `cpu-bin/llama-tokenize.exe -m <model> -f <prompt> --no-escape --offline --ids --show-count`. Retained report integrity can be checked without model assets: `node research/verify-reference.mjs`. This verifier replays no inference and validates no new model result.

## Consequence

Do not change engines, quantization, providers or canonical data on the basis of these failures. The normal source-selection defect remains open. Further work must improve subject binding/control and revalidate the **ordinary retained-context flow**, preserving failed turns. Smaller isolated successes and structurally valid tool execution cannot substitute for that gate. All prior typed settings/tools, media, custom adapters, storage/archive and full-process/physical-device gates remain. Runtime-specific redistribution licensing remains unresolved; this diagnostic does not relicense it or add the reference engine to app assets.
