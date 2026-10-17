# Speech startup status and input gate

Unit46 actual offline reopen showed first plain-text Send refused as Reading attachments. useSpeech startup status shares SpeechClient's busy callback with real prepare/transcribe. Keep per-worker pending exclusion, Stop/errors and actual preparation/transcription busy behavior; report read-only status as non-processing so it cannot block text-only Send. No automatic replay or readiness manufacture. Regression first, then complete controls/build/runtime and native offline initial Send.
