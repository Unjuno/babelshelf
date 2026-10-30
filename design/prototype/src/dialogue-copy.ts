import {resolveDialogueTarget,readDialogueTurn,dialogueTurnStatus,type Dialogue,type DialogueTarget,type SourceRef} from './conversation.ts';

export type DialogueCopy={schema:1;noteRevision:1;turnId:string;turnIndex:number;speaker:'user'|'assistant';quote:string;refs:SourceRef[];edited:boolean};
type Candidate={turnId:string;turnIndex:number;user:boolean;assistant:boolean};
export type DialogueCopyReview={candidates:Candidate[];source:ReturnType<typeof readDialogueTurn>};
export type DialogueCopyOption={turnId:string;index:number;speaker:'user'|'assistant';preview:string;selected:boolean};
/** Read-only labels for the existing snapshot-bound source selector. Full
 * originals and validation remain with selectDialogueCopy/reviewedDialogueCopy. */
export function dialogueCopyPage(state:Dialogue,review:DialogueCopyReview,query='',page=0){
 if(!Number.isSafeInteger(page)||page<0||typeof query!=='string'||query.length>200)throw Error('Invalid source search');
 const needle=query.trim().normalize('NFKC').toLocaleLowerCase(),items:DialogueCopyOption[]=[],size=12,skip=page*size;let matched=0;
 for(let i=review.candidates.length-1;i>=0;i--){const candidate=review.candidates[i],turn=state.turns[candidate.turnIndex];if(turn?.id!==candidate.turnId)continue;
  for(const speaker of ['assistant','user'] as const){const text=speaker==='assistant'?turn.answer:turn.user;if(!candidate[speaker]||!text||needle&&!text.normalize('NFKC').toLocaleLowerCase().includes(needle))continue;
   if(matched++<skip)continue;if(items.length===size)return {items,hasMore:true};
   const preview=Array.from(text.slice(0,240)).slice(0,120).join('').replace(/\s+/gu,' ').trim();
   items.push({turnId:turn.id,index:candidate.turnIndex,speaker,preview,selected:review.source.turnId===turn.id&&review.source.speaker===speaker});
  }
 }
 return {items,hasMore:false};
}
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const changed=()=>Error('Dialogue source changed · choose again');

export function makeDialogueCopyReview(state:Dialogue,target:DialogueTarget):DialogueCopyReview{
 const source=resolveDialogueTarget(state,target);
 return {source:structuredClone(source),candidates:state.turns.flatMap((turn,turnIndex)=>turn.user||turn.answer?[{turnId:turn.id,turnIndex,user:!!turn.user,assistant:!!turn.answer}]:[])};
}
export function makeAnswerCopyReview(state:Dialogue,turnId:string,expectedBody:string){
 const index=state.turns.findIndex(turn=>turn.id===turnId),review=makeDialogueCopyReview(state,{target:'history',historyIndex:index,historyPart:'assistant'});
 if(review.source.quote!==expectedBody)throw changed();return review;
}
export function selectDialogueCopy(state:Dialogue,review:DialogueCopyReview,index:number,speaker:'user'|'assistant'):DialogueCopyReview{
 const candidate=review.candidates.find(c=>c.turnIndex===index);
 if(!candidate||!['user','assistant'].includes(speaker)||!candidate[speaker])throw Error('Earlier message unavailable');
 if(state.turns[index]?.id!==candidate.turnId)throw changed();
 return {candidates:structuredClone(review.candidates),source:structuredClone(readDialogueTurn(state,index,speaker))};
}
export function dialogueCopyIsPartial(state:Dialogue,source:{turnId:string;turnIndex:number;speaker:string}){
 const turn=state.turns[source.turnIndex];if(source.speaker!=='assistant'||turn?.id!==source.turnId)return false;
 const status=dialogueTurnStatus(turn);return status==='Partial · incomplete inspection'||status==='Source excerpt · partial answer';
}
export function assertDialogueCopySource(state:Dialogue|undefined,source:{turnId:string;turnIndex:number;speaker:string;quote:string;refs:SourceRef[]},expectedCoverage?:'partial'|'complete'){
 if(!state||state.turns[source.turnIndex]?.id!==source.turnId)throw changed();
 let original;try{original=readDialogueTurn(state,source.turnIndex,source.speaker);}catch{throw changed();}
 if(original.quote!==source.quote||!equal(original.refs,source.refs)||expectedCoverage!==undefined&&dialogueCopyIsPartial(state,source)!==(expectedCoverage==='partial'))throw changed();
}
export function reviewedDialogueCopy(state:Dialogue,review:DialogueCopyReview,body:string){
 assertDialogueCopySource(state,review.source);
 if(typeof body!=='string'||body.length>10000000)throw Error('Invalid copy content');
 const source=review.source,speaker=source.speaker as 'user'|'assistant';
 const dialogueCopy:DialogueCopy={schema:1,noteRevision:1,turnId:source.turnId,turnIndex:source.turnIndex,speaker,quote:source.quote,refs:structuredClone(source.refs),edited:body!==source.quote};
 return {body,kind:speaker==='assistant'?'generated' as const:'original' as const,sources:structuredClone(source.refs),dialogueCopy,...(dialogueCopyIsPartial(state,source)?{dialogueCopyCoverage:'partial' as const}:{})};
}
// A retained creation snapshot, never a new request or authority to alter dialogue.
// Later note revisions preserve this metadata anchored to note revision 1.
export function validateDialogueCopyRecord(note:any){
 const copy=note?.dialogueCopy,coverage=note?.dialogueCopyCoverage;if(copy===undefined&&coverage===undefined)return;
 if(!copy||Object.keys(copy).length!==8||Object.keys(copy).some(key=>!['schema','noteRevision','turnId','turnIndex','speaker','quote','refs','edited'].includes(key)))throw Error('Invalid dialogue copy origin');
 if(copy.schema!==1||copy.noteRevision!==1||typeof copy.turnId!=='string'||!copy.turnId||!Number.isSafeInteger(copy.turnIndex)||copy.turnIndex<0||!['user','assistant'].includes(copy.speaker)||typeof copy.quote!=='string'||!copy.quote||copy.quote.length>10000000||!Array.isArray(copy.refs)||typeof copy.edited!=='boolean'||coverage!==undefined&&(coverage!=='partial'||copy.speaker!=='assistant'))throw Error('Invalid dialogue copy origin');
 const first=note.revisions?.[0];
 if(!first||copy.edited!==(first.body!==copy.quote)||note.kind!==(copy.speaker==='assistant'?'generated':'original')||!equal(note.sources,copy.refs))throw Error('Invalid dialogue copy origin');
}
