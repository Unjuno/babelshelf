import {isMemoryPassageResult,type MemoryPassageResult,type MemorySearchResult} from './memory-search-types.ts';
import {mergeStoredSearchResults} from './file-discovery.ts';

/** Merge bounded lexical results with an explicitly selected, already-loaded
 * semantic route. Canonical file records and exact lexical passages remain
 * available when the optional model is absent or idle. */
export async function combineMemorySearchResults(
 query:string,
 lexical:MemorySearchResult[],
 semanticSearch?:(query:string,signal?:AbortSignal)=>Promise<MemoryPassageResult[]|null>,
 signal?:AbortSignal,
):Promise<MemorySearchResult[]>{
 signal?.throwIfAborted();
 if(!semanticSearch)return lexical;
 const semantic=await semanticSearch(query,signal);
 signal?.throwIfAborted();
 if(!semantic?.length)return lexical;
 const files=lexical.filter((item):item is Extract<MemorySearchResult,{kind:'file'}>=>item.kind==='file');
 const passages=lexical.filter(isMemoryPassageResult);
 return mergeStoredSearchResults(files,[...semantic,...passages],12,query);
}
