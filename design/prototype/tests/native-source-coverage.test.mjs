import test from 'node:test';
import assert from 'node:assert/strict';
import {agentEvidenceFromCalls} from '../src/agent-evidence.ts';
import {planDialogue} from '../src/dialogue-planner.ts';

test('native evidence never silently drops an entire observed source',()=>{
 const row=(id,start,quote)=>({tool:'memory.read',arguments:{query:id},result:[{noteId:id,path:`Notes/${id}.md`,revision:1,start,excerpt:quote,partial:true,totalChars:10000}]});
 const crowd=Array.from({length:64},(_,i)=>row('first',i*10,`range${i}`));
 const selected=agentEvidenceFromCalls([...crowd,row('second',0,'second source')]);
 assert.ok(selected.some(ref=>ref.noteId==='first'));assert.ok(selected.some(ref=>ref.noteId==='second'));
 const tooMany=Array.from({length:65},(_,i)=>row(`note-${i}`,0,`source ${i}`));
 assert.throws(()=>agentEvidenceFromCalls(tooMany),/Context limit.*sources/);
});

test('conflicting quotations for the same original version and range are rejected',()=>{
 const call=quote=>({tool:'memory.search',arguments:{query:'note'},result:[{noteId:'note',revision:1,start:0,end:3,quote}]});
 assert.throws(()=>agentEvidenceFromCalls([call('one'),call('two')]),/Source.*conflict/);
 assert.equal(agentEvidenceFromCalls([call('one'),call('one')]).length,1);
 const crowded=Array.from({length:64},(_,i)=>({tool:'memory.search',arguments:{query:String(i)},result:[{noteId:'note',revision:1,start:i*3,end:i*3+3,quote:'one'}]}));
 const beyond={tool:'memory.search',arguments:{query:'beyond'},result:[{noteId:'note',revision:1,start:192,end:195,quote:'one'}]};
 assert.throws(()=>agentEvidenceFromCalls([...crowded,beyond,{...beyond,result:[{...beyond.result[0],quote:'two'}]}]),/Source.*conflict/);
});

test('duplicate references never restore grounding eligibility withdrawn by a later observation',()=>{
 const call=groundingEligible=>({tool:'memory.search',arguments:{query:'note'},result:[{noteId:'note',revision:1,start:0,end:3,quote:'one',groundingEligible}]});
 for(const calls of [[call(true),call(false)],[call(false),call(true)]])assert.equal(agentEvidenceFromCalls(calls)[0].groundingEligible,false);
});

test('a later ineligible custom-tool observation removes the original citation label',async()=>{
 const tool={id:'user.lookup',effect:'read',network:'none'},ref={noteId:'note',revision:1,start:0,end:3,quote:'one'};
 const history=[{tool:tool.id,arguments:{query:'first'},result:{ok:true}},{tool:tool.id,arguments:{query:'second'},result:{ok:true}}];
 const observedSources=new Map([[0,[{...ref,groundingEligible:true}]],[1,[{...ref,groundingEligible:false}]]]);let format;
 const engine={plannerProtocol:'native-tool-calls',manifest:{contextTokens:4096},count:async()=>({prompt_tokens:100}),generate:async(_messages,_budget,value)=>{format=value;return {text:JSON.stringify({action:'answer',reply:{status:'insufficient_evidence',answer:'No current source.',sources:[]}})};}};
 await planDialogue(engine,'Explain the saved record.',{summary:'',recent:[],refs:[],turnCount:0},[],{allowedTools:[tool],history,observedSources});
 assert.equal(format.tools.find(item=>item.function.name==='finish_answer').function.parameters.properties.reply.properties.sources.maxItems,0);
});
