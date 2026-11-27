/** Revision-pinned references to text derived from the current submitted input. */
export type InputReadingRef={kind:'ocr'|'pdf'|'speech'|'vision';noteId:string;revision:1};
export type CurrentInputRef=InputReadingRef|{kind:'text'|'video-audio';noteId:string;revision:1};
