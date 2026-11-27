import type {Transcript} from './speech-transcript.ts';

/** Transcript evidence attached to one dialogue message with an optional prompt range. */
export type VoiceInput={schema:1;transcript:Transcript;prompt:{start:number;end:number}|null};
