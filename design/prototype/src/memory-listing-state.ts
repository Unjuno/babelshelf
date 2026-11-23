export type SemanticMemorySearchState='idle'|'not-ready'|'searching'|'ready'|'error';

export function shouldShowMemoryEmptyState(input:{visibleFolderCount:number;visibleNoteCount:number;semanticHitCount:number;searchState:SemanticMemorySearchState}){
 return input.visibleFolderCount===0&&input.visibleNoteCount===0&&input.semanticHitCount===0&&input.searchState!=='searching';
}
