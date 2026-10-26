import {dialogueOutcome,focusExcerpt,requestNamesEarlierDialogue,type Dialogue,type DialogueContext} from './conversation.ts';
// @ts-expect-error Canonical lexical search is JavaScript.
import {searchNotes} from '../../../dist/core.js';

/** An information request about an earlier application result, never a command. */
function asksOutcome(text:string){
 if(!text||text.length>500||/[\r\n;；]/u.test(text)||/(?:保存して|削除して|消して|変更して|実行して|作成して|送信して)|\b(?:and|then)\s+(?:save|delete|remove|edit|run|send)|[?!.]\s*(?:please\s+)?(?:save|delete|remove|edit|run|send)\b/iu.test(text))return false;
 const asks=/[?？]|(?:教えて|確認して|どうなった|ですか|ましたか|したか|したの)[。！!]*$/u.test(text);
 const result=/\b(?:status|outcome)\b|\b(?:did|was|were|has|have)\b.{0,70}\b(?:save|saved|cancel|cancelled|canceled|finish|finished|complete|completed|succeed|succeeded|fail|failed)\b|(?:操作結果|実行結果|処理結果|保存され|保存でき|保存したか|保存済み|実行された|実行でき|キャンセルされた|キャンセルしたか|取消された|成功した|失敗した|完了した)/iu.test(text);
 return asks&&result;
}

/** Read-only projection from retained turns. Inquiry retries are not evidence of
 * the requested operation; model prose and compaction are never outcome records. */
export function earlierOperationContext(state:Dialogue,question:string,currentInputs=false):DialogueContext|null{
 if(currentInputs||!requestNamesEarlierDialogue(question)||!asksOutcome(question.trim()))return null;
 const entries=state.turns.flatMap((turn,index)=>{
  const outcome=dialogueOutcome(turn);if(!outcome||asksOutcome(turn.user.trim()))return [];
  return [{id:turn.id,turnIndex:index,kind:'original',state:'active',aliases:[],sources:[],revisions:[{version:1,title:'Earlier request '+index,body:turn.user}]}];
 });
 const seen=new Set<string>(),recalled:NonNullable<DialogueContext['recalled']>=[];
 for(const hit of searchNotes(entries,question,6)){
  if(seen.has(hit.noteId))continue;const entry=entries.find(item=>item.id===hit.noteId);if(!entry)continue;
  const turn=state.turns[entry.turnIndex],outcome=dialogueOutcome(turn);if(!outcome)continue;
  seen.add(turn.id);recalled.push({turnId:turn.id,turnIndex:entry.turnIndex,speaker:'user',...focusExcerpt(turn.user,question,240),outcome});if(recalled.length===3)break;
 }
 if(!recalled.length)return null;
 return {outcomeOnly:true,summary:'',recent:[],refs:[],turnCount:state.turns.length,recalled};
}
