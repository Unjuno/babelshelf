import {resolveDialogueTarget,readDialogueTurn,type Dialogue,type DialogueTarget,type SourceRef} from './conversation.ts';

export type DialogueCopy={schema:1;noteRevision:1;turnId:string;turnIndex:number;speaker:'user'|'assistant';quote:string;refs:SourceRef[];edited:boolean};
type Candidate={turnId:string;turnIndex:number;user:boolean;assistant:boolean};
export type DialogueCopyReview={candidates:Candidate[];source:ReturnType<typeof readDialogueTurn>};
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
export function assertDialogueCopySource(state:Dialogue|undefined,source:{turnId:string;turnIndex:number;speaker:string;quote:string;refs:SourceRef[]}){
 if(!state||state.turns[source.turnIndex]?.id!==source.turnId)throw changed();
 let original;try{original=readDialogueTurn(state,source.turnIndex,source.speaker);}catch{throw changed();}
 if(original.quote!==source.quote||!equal(original.refs,source.refs))throw changed();
}
export function reviewedDialogueCopy(state:Dialogue,review:DialogueCopyReview,body:string){
 assertDialogueCopySource(state,review.source);
 if(typeof body!=='string'||body.length>10000000)throw Error('Invalid copy content');
 const source=review.source,speaker=source.speaker as 'user'|'assistant';
 const dialogueCopy:DialogueCopy={schema:1,noteRevision:1,turnId:source.turnId,turnIndex:source.turnIndex,speaker,quote:source.quote,refs:structuredClone(source.refs),edited:body!==source.quote};
 return {body,kind:speaker==='assistant'?'generated' as const:'original' as const,sources:structuredClone(source.refs),dialogueCopy};
}
// A retained creation snapshot, never a new request or authority to alter dialogue.
// Later note revisions preserve this metadata anchored to note revision 1.
export function validateDialogueCopyRecord(note:any){
 const copy=note?.dialogueCopy;if(copy===undefined)return;
 if(!copy||Object.keys(copy).length!==8||Object.keys(copy).some(key=>!['schema','noteRevision','turnId','turnIndex','speaker','quote','refs','edited'].includes(key)))throw Error('Invalid dialogue copy origin');
 if(copy.schema!==1||copy.noteRevision!==1||typeof copy.turnId!=='string'||!copy.turnId||!Number.isSafeInteger(copy.turnIndex)||copy.turnIndex<0||!['user','assistant'].includes(copy.speaker)||typeof copy.quote!=='string'||!copy.quote||copy.quote.length>10000000||!Array.isArray(copy.refs)||typeof copy.edited!=='boolean')throw Error('Invalid dialogue copy origin');
 const first=note.revisions?.[0];
 if(!first||copy.edited!==(first.body!==copy.quote)||note.kind!==(copy.speaker==='assistant'?'generated':'original')||!equal(note.sources,copy.refs))throw Error('Invalid dialogue copy origin');
}
