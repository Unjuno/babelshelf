import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeFinalPlanTools} from '../src/native-output-format.ts';
import {planDialogueMessages} from '../src/dialogue-planner.ts';

test('native reply rules occur once in shared instructions without weakening function source schemas',()=>{
 const scope={inputs:false,file:false,current:false,historyCount:0,assistantIndices:[],toolIds:[]};
 for(const labels of [[],['S1','S2']]){
  const tools=nativeFinalPlanTools(scope,labels,true);
  const replies=tools.filter(item=>item.function.parameters.properties.reply);
  assert.equal(replies.length,3);
  for(const {function:fn} of replies){
   assert.match(fn.description,/complete content in reply/);
   assert.doesNotMatch(fn.description,/Source labels belong/);
   const reply=fn.parameters.properties.reply;
   assert.deepEqual(reply.required,['status','answer','sources']);
   assert.equal(reply.additionalProperties,false);
   assert.equal(reply.properties.sources.maxItems,labels.length);
   assert.equal(reply.properties.sources.uniqueItems,true);
   assert.deepEqual(reply.properties.sources.items.enum,labels.length?labels:undefined);
  }
 }
 const messages=planDialogueMessages('Check saved sources',{summary:'',recent:[],refs:[],turnCount:0},[],{allowedTools:[],history:[]},true);
 const text=messages.map(m=>m.content).join('\n');
 assert.equal(text.split('Source labels belong only in sources').length-1,1);
 assert.match(text,/no labels means sources=\[\]/);
 assert.match(text,/storage IDs and tool-call syntax/);
 assert.match(text,/unless explicitly requested or literal source content/);
 assert.match(text,/insufficient_evidence with sources=\[\]/);
});


test('native planner includes recalled originals once while preserving legacy history and selectors',()=>{
 const quote='ARCHIVE_UNIQUE_42',context={summary:'Earlier summary',recent:[],refs:[],turnCount:4,lastAnswerIndex:3,currentResult:{turnId:'last'},recalled:[{turnId:'earlier',turnIndex:1,speaker:'assistant',quote,start:0,end:quote.length}]},before=structuredClone(context);
 for(const native of [false,true]){
  const messages=planDialogueMessages('Continue our discussion',context,[],{allowedTools:[],history:[]},native);
  const text=messages.map(message=>message.content).join('\n');
  assert.equal(text.split(quote).length-1,1);
  assert.match(text,/"speaker":"assistant"/);assert.match(text,/"turnIndex":1/);
  assert.match(text,/"currentResult":\{"turnId":"last"\}/);
  if(native){
   const metadata=messages.find(message=>message.content.startsWith('Current application context'));
   assert.doesNotMatch(metadata.content,/ARCHIVE_UNIQUE_42|originalEarlierExcerpts/);
   assert.match(text,/Distinguish user statements from assistant claims/);
  }else assert.match(text,/originalEarlierExcerpts/);
 }
 assert.deepEqual(context,before);
});
