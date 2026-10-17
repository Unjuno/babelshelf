# App-owned local CPU count runtime

These committed assets are generated from pinned wllama3.8.1/llama.cpp plus the count patch in research/runtime/wllama-count. manifest.json records source revisions, patch SHA256 and exact distribution bytes. scripts/check-lfm.mjs checks all four assets before the product build. The generated JavaScript has -text Git attributes to preserve byte identity. Normal npm builds consume these files without downloading or compiling a replacement runtime.

index.js is the shared JavaScript library with the default native worker code embedded. default.wasm is its CPU JSPI/memory64 binary. compat.js and compat.wasm are the separately compiled CPU Asyncify/memory32 pair. Automatic runtime compatibility selection uses only these local resources, never default CDN resources. The normal adapter explicitly selects CPU, not an implicit WebGPU/provider fallback.

Source/build details and native receipts: research/runtime/wllama-count/README.md, native-build.json, native-compat-build.json, count.patch and source-pins.json. Packaging command: node scripts/qa/build-count-runtime.mjs SOURCE NEW_OUTPUT compat. Product files are copied only after exact bundle/native/default-embedded pin checks. The model weights are separate and not included here.

Attribution is included in design/prototype/licenses/wllama-MIT.txt and llama-cpp-MIT.txt, copied into the product license directory by the build. LFM model license texts are separate. No model license is applied to another runtime. Native PC default/compat count-generation evidence does not establish physical Safari/iPhone/Android acceptance.
