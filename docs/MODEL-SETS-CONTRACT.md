# Model set contract

Model sets are named presets for the four role selections stored in `Settings > Models`: text generation, decision routing, speech transcription, and image text extraction. They are a convenience for selecting a known combination; they are not executable workflows, downloaded bundles, or device compatibility claims.

The initial sets are `Compact text` (LFM2.5 230M, text only), `Text + media` (Bonsai 2 4B, Whisper tiny, Tesseract 7), and `Local pipeline` (the same roles plus Open d1 Omni 600M for decisions). Each preset references a model ID already present in the app-owned local catalog. A catalog check rejects unknown IDs at module initialization and application time.

Choosing a set opens a review of each role assignment. Only explicit `Apply set` commits. This updates the model preference record once, appends its revision using the existing preference writer, and adds selected built-in IDs to their role libraries. It preserves custom model declarations, previously registered library entries, downloaded/prepared assets, appearance, connection settings, memory files, schedules, and activity. It does not download, prepare, load, unload, or execute any model. Network/download settings remain unchanged.

A selected set says nothing about whether the assets are present, the runtime can execute the model on a particular browser/device, or quality/performance is acceptable. Users prepare and verify assets separately. Future custom model registration remains an explicit separate flow; these presets never remove a custom registration.
