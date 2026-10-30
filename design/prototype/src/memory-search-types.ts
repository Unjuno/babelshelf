import type {FileResult} from './file-discovery.ts';

/** A text excerpt may be used as evidence only after the canonical source check. */
export type MemoryPassageResult={
 kind?:'passage';
 noteId:string;
 revision:number;
 title:string;
 path?:string;
 start:number;
 end:number;
 quote:string;
 score:number;
 groundingEligible?:boolean;
};

/** File discovery is navigation metadata; it does not contain citable source text. */
export type MemorySearchResult=MemoryPassageResult|FileResult;

export function isMemoryPassageResult(result:MemorySearchResult):result is MemoryPassageResult{
 return result.kind!=='file';
}
