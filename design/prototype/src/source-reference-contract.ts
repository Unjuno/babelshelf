/** Ephemeral, revision-pinned evidence reference shared by conversation and tool workflows. */
export type SourceRef={noteId:string;revision:number;start:number;end:number;quote:string;citedQuote?:string;title?:string;groundingEligible?:boolean};
