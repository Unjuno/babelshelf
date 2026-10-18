# Video audio timeline integration

## Objective

Connect transcript citations to the original container timeline while preserving original ID/revision/hash, history, local-only processing and the accepted on-demand preview. Do not reinterpret legacy decoded-audio times or claim video-frame understanding.

## Decoder evidence (Unit210)

Unit210 installed Mediabunny 1.61.6 only in outputs/unit210-media-runtime for diagnosis. Unit211 pins it as a product dependency. Its MPL-2.0 license, notice and unmodified source archive are included in the offline shell, separately from model/runtime licenses. Official API references: https://mediabunny.dev/guide/media-sinks and https://mediabunny.dev/guide/reading-media-files . AudioBufferSink retains presentation timestamps; Input.dispose closes decoders and cancels reads. Only local Blob sources are used.

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

## Unit211 implemented contract

New video ingestion with WebCodecs uses the lazy local MP4/WebM decoder. Exactly one audio track is required; multiple tracks report selection required rather than claiming all tracks were read. Unsupported codecs/timing fail explicitly. Browsers without AudioDecoder retain the prior decoded-audio path and whole-video source behavior. No data migration or inferred mapping of old transcripts.

The PCM assembler positions decoded buffers on their presentation timeline, downmixes channels, preserves silent gaps, clips padding to the track interval and rejects contradictory overlaps/nonfinite samples. Limits remain32MiB original and120seconds processed audio, with up to8channels and192kHz input. These bounds do not certify phone memory. Native OfflineAudioContext resamples to mono16kHz. Cancellation disposes the demuxer/decoders and refuses late results.

Transcript containerTiming pins schema1, processor mediabunny-1.61.6, container-presentation timebase, track ID and integer start/end microseconds. Duration must match the span. It is separate from existing model-estimated segment times. Original references/model pins are unchanged. Backup validation retains/rejects this metadata atomically. Exact initial transcript citations add the verified container offset; edited/ambiguous and legacy transcripts retain whole-original fallback. The original video seeks only when the range explicitly carries seekable=true; playback is still user-initiated.

Production-module Chrome evidence:5.001–13.121s becomes8120ms/129920 real16kHz samples; actual PCM present; pre-aborted and interrupted decode return Stopped. Node tests cover padding, gaps, contradictions, metadata, legacy behavior and backup. Normal installed inference/source UI verification is recorded separately in TEST-RESULTS.
