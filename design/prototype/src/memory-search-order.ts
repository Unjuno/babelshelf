/** Put semantic matches first without dropping lexical matches or mutating the
 * canonical note order. The first passage returned for each note is its best
 * semantic rank because the search service returns passages in score order. */
export function orderMemorySearchNotes<T extends {id:string}>(
 lexical:readonly T[],
 semanticNoteIds:readonly string[],
 semanticReady:boolean,
):T[]{
 if(!semanticReady||semanticNoteIds.length===0)return [...lexical];
 const rank=new Map<string,number>();
 semanticNoteIds.forEach((id,index)=>{if(!rank.has(id))rank.set(id,index);});
 return [...lexical].sort((a,b)=>(rank.get(a.id)??Number.MAX_SAFE_INTEGER)-(rank.get(b.id)??Number.MAX_SAFE_INTEGER));
}
