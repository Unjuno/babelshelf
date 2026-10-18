# Pinned WebML runtime provenance check

Checked 2026-10-18, Unit219. This records available upstream evidence, not a legal opinion or a redistribution grant.

The product pins `webml-community/ternary-bonsai-2-hermes-webgpu` revision `621e20782f208660f4f58283c2ce58430020f243`. Its [recursive repository tree](https://huggingface.co/api/spaces/webml-community/ternary-bonsai-2-hermes-webgpu/tree/621e20782f208660f4f58283c2ce58430020f243?recursive=true&limit=100) returned15entries with no pagination link. No runtime LICENSE or source map was listed.

The [README](https://huggingface.co/spaces/webml-community/ternary-bonsai-2-hermes-webgpu/blob/621e20782f208660f4f58283c2ce58430020f243/README.md) has Space/model metadata but no runtime license. [THIRD_PARTY_NOTICES](https://huggingface.co/spaces/webml-community/ternary-bonsai-2-hermes-webgpu/blob/621e20782f208660f4f58283c2ce58430020f243/THIRD_PARTY_NOTICES.md) scopes the Hermes MIT notice to CLI banner/theme visual references and separately identifies font licenses. It does not grant a license to this inference bundle.

The pinned JS was retrieved into process memory and matched the manifest exactly:2208435bytes, SHA-256 `00c1a72a962a84fee17000a6b1d18b24d75033e56d59996fc504b7c57cfc6488`. A case-insensitive scan found no copyright, license or sourceMappingURL strings. This absence cannot establish ownership or a license elsewhere. The JS was not added to source or public distribution. Retained evidence: outputs/unit219-runtime-license/evidence.json (URLs, hashes, README/notices and scan result; no full runtime).

Conclusion: runtime-specific redistribution permission remains unconfirmed. Keep explicit direct upstream acquisition and the existing manifest warning. Do not substitute the model's Apache-2.0 license or visual-reference MIT notice. Closing this gate requires an explicit grant covering the pinned bundle, or verifiable licensed source/build provenance. Do not repeat this same fixed-revision scan without new upstream evidence. No publisher contact was sent and no runtime/model/engine selection changed.
