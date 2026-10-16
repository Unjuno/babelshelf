import {KnowledgeStore} from '../src/knowledge-store';
import {emptyDialogue,appendTurn,completeTurn,validateDialogue,type Dialogue} from '../src/conversation';
const output=document.querySelector('#results')!;
document.querySelector('#run')!.addEventListener('click',async()=>{
 const name='babelshelf-dialogue-qa-'+crypto.randomUUID(),a=new KnowledgeStore(name),b=new KnowledgeStore(name),lines:string[]=[];
 const check=(ok:boolean,label:string)=>{if(!ok)throw Error(label);lines.push('PASS · '+label);output.textContent=lines.join('\n');};
 try{
  await a.initialize([]);const state=completeTurn(appendTurn(emptyDialogue(),{id:'first',user:'保存しない会話の原文 🌳'}),'first',{answer:'Local reply fixture; no inference.',toolCalls:[{name:'text.replace',target:{turnId:'first',turnIndex:0,speaker:'user'},arguments:{find:';',with:'\n'},result:{matches:1,text:'Local reply fixture; no inference.'}}]});
  await a.compareState('dialogue',undefined,state);a.close();
  const reopened=validateDialogue(await b.getState('dialogue'));check(JSON.stringify(reopened)===JSON.stringify(state),'exact dialogue survives database close/reopen');
  const competing=appendTurn(state,{id:'second',user:'続き'});const writes=await Promise.allSettled([a.compareState('dialogue',state,competing),b.compareState('dialogue',state,{...competing,revision:3})]);
  check(writes.filter(r=>r.status==='fulfilled').length===1,'concurrent tabs cannot silently replace dialogue');
  const current=(await a.getState<Dialogue>('dialogue'))!,summary={...current,revision:current.revision+1,compaction:{through:1,summary:'Storage fixture only'}};
  await a.compareState('dialogue',current,summary);a.close();
  const compacted=validateDialogue(await b.getState('dialogue'));check(compacted.compaction?.through===1&&compacted.turns[0].user===state.turns[0].user,'summary cursor and original dialogue persist separately');
  check((await b.all()).length===0,'conversation never becomes a saved knowledge note automatically');
  lines.push('DONE · 4 real IndexedDB checks. No inference tested.');output.textContent=lines.join('\n');
 }catch(e){output.textContent+='\nFAIL · '+(e as Error).message;}finally{a.close();b.close();}
});
