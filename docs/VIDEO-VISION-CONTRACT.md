# Sampled local video observations

Ordinary Send can use the selected, already-prepared LFM2.5-VL model on a bounded video sample. This is sparse frame observation, not full video, motion or event understanding. With no Vision selection, the existing audio-only path remains. A selected but unprepared/failing Vision model refuses; it never silently becomes audio-only or acquires assets.

## Processing and ownership

`video-frames.ts` accepts a local Blob at most32MiB through pinned Mediabunny1.61.6 MP4/WebM demuxers. Exactly one decodable video track is required. Visible duration is at most10minutes; input display dimensions at most64megapixels. Three requested timestamps are the midpoints of successive thirds of the nonnegative presentation interval, deduplicated at microsecond precision for extremely short input. There is no implicit clipping, URL source or codec download.

The real decoded presentation timestamp/duration must contain each requested timestamp. Actual and requested times remain distinct. One reused canvas preserves display aspect ratio with maximum side768pixels; each JPEG is at most2MiB. The decoder is disposed before inference. At most three compressed frame Blobs remain for one sequential image batch. The existing VisionClient releases idle Text/Decision, loads one image model for the batch, disposes per-frame tensors, then terminates its worker. Stop invalidates pending decoding/model work and prevents late results/commit. This is same-tab ownership, not proof of driver memory release, cross-tab exclusion or phone fit.

After visual reading, selected/prepared speech may transcribe the same original when its interval fits the existing120-second bound. Missing audio track, unselected/unprepared speech and a longer interval are explicit audio-not-processed states. Other audio failures propagate. Audio model/runtime/timing provenance stays separate from Vision pins. Speech never substitutes for visual reading, and a sampled frame does not explain simultaneous speech automatically.

## Persistence and citations

The immutable raw video remains separate from a normal generated file linked by mediaSource. Its visionText schema2/scope sampled-video retains original ID/revision/SHA256, model/runtime revision, exact prompt, plan, requested/actual times, dimensions, encoded-frame SHA256, frame observation text/ranges and optional independently validated transcript. Image schema1 is unchanged. Encoded JPEG bytes are not separate saved files: the retained source is the original video; re-decoding does not promise byte-identical encoding across browsers.

Coverage and unprocessed audio are explicit. Observations may be wrong or speculative. Evidence supplies only actual observation/transcript spans, never processing headings as factual quotes; sampled times/coverage are separate metadata. Raw/derived/dialogue commit remains atomic. Backup/restore validates the original graph, plan, frame text/ranges and nested transcript provenance.

A citation opens the original video. Unchanged v1 frame quotes select actual frame times. Audio quotes use existing transcript mapping with estimated/unmapped timing stated. Mixed/heading-only ranges and edited observations open the whole original. Historical whole-observation citations remain valid. Source integrity is distinct from visual inference truth.

## Evidence and remaining gates

Initial actual local PC Codex-sidebar f74c4c273e5772d8: Downloads OFF, prepared Vision450M/Whisper base/Bonsai2B, sample.mp4 -> ordinary Send -> observations at0.100/0.500/0.800s -> no-audio-track -> stored source -> real color-list answer/citation -> source body/original preview. Color naming was imperfect. The first answer cited the coverage heading; a regression reproduced this and evidence was corrected to observation spans. Follow-up evidence uses its own build in TEST-RESULTS.txt.

Controlled tests cover bounds, refusal, Stop/no late audio, output identity, source/backup graph and text ranges; these are not codec/GPU accuracy tests. Phone, all-process offline cold start, rotated/VFR/long-GOP/multiple-track inputs, real audio-plus-visual composition, broad accuracy and memory pressure remain separate gates. One color-bar sample is not full-media acceptance.
