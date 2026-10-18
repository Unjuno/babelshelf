# Video audio timeline integration

## Objective

Connect transcript citations to the original container timeline while preserving original ID/revision/hash, history, local-only processing and the accepted on-demand preview. Do not reinterpret legacy decoded-audio times or claim video-frame understanding.

## Decoder evidence (Unit210)

Mediabunny 1.61.6 is installed only in outputs/unit210-media-runtime for diagnosis, not as a product dependency. Its license is MPL-2.0; any integration must include its license and source availability separately from model/runtime licenses. Official API references: https://mediabunny.dev/guide/media-sinks and https://mediabunny.dev/guide/reading-media-files . AudioBufferSink retains presentation timestamps; Input.dispose closes decoders and cancels reads. Only local Blob sources are proposed.

Command: node scripts/qa/video-timeline-probe.mjs ../../outputs/unit210-video-timeline

Actual Chrome, existing WebM fixtures, real decoder, no transcription/model substitution:

- Normal original SHA e1950c5b4733fcd6ad628a590174653b9dd32d4c2d9b9853fb124b5f288b2107: first0s, decoded end8.1335s, demuxed track end8.121s.
- Delayed original SHA28a50b7cc20f33adda1f96db90dd038577e4df388f18359ef1bcc9061d36dee1: first5.001s, decoded end13.1345s, demuxed track end13.121s.
- Each407buffers/390408frames, continuous within floating-point rounding. The5.001s offset survives decoding. Decoder tail exceeds track end12.5ms: naive concatenation plus offset is insufficient for a verified saved mapping.

Evidence: outputs/unit210-video-timeline/evidence.json. This proves a viable decoder primitive, not integrated citation seeking, MP4 support, recognition accuracy or physical-device acceptance. Public version10 remains unchanged.

## Implementation and acceptance

1. Pin the dependency/license/source notice and include its lazy assets in the offline shell. Use bounded local input, cancellation/disposal, explicit supported formats and an explicit multiple-track policy.
2. Preserve presentation intervals through downmix/resampling, trim decoder padding and handle gaps without compressing silence. Verify native playback time origin before asserting a mapping.
3. Add versioned processor/track/timeline provenance to transcript validation and backup round trips. Keep model-estimated segments separate. Legacy records retain whole-video fallback; edited transcripts retain no precise segment alignment.
4. Map validated transcript citations to original video time on demand, with estimated/audio-only labels. No invented frame coverage.
5. Verify real delayed-video transcription, reviewed save, citation/nonzero seek, backup/cold reopening and Stop/failure controls. Keep module, product PC and physical-device evidence separate.
