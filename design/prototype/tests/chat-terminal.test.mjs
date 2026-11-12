import test from 'node:test';
import assert from 'node:assert/strict';
import {planDialogue,contextIndependentConversation} from '../src/dialogue-planner.ts';
import {nativeFinalPlanTools} from '../src/native-output-format.ts';
import {groundedAnswer} from '../src/grounded-answer.ts';
import {dialogueOutputLimits,requestsOneSentence} from '../src/reply-style.ts';

const context={summary:'',recent:[],refs:[],turnCount:0};
const manifest={contextTokens:8192,maxOutputTokens:8192,models:[{id:'test',revision:'fixture'}],runtime:{revision:'fixture'}};
const reply={status:'answered',answer:'The blue sky comes from sunlight scattered by the atmosphere.',sources:[]};
const noWork=async()=>{throw Error('Unexpected generation or storage read');};
const engine=(result)=>({plannerProtocol:'native-tool-calls',manifest,count:async()=>({prompt_tokens:300}),generate:async()=>({text:JSON.stringify(result),finishReason:'stop'})});

test('greeting request format modifiers compose without turning source or compound work into fresh chat',()=>{
 for(const question of ['Say hello in one short sentence.','Please say hi in a single brief sentence.','In one sentence, say hello.','Give me a greeting in one concise sentence.','Write a brief greeting in exactly one sentence.']){
  const selected=contextIndependentConversation(question,[],context);
  assert.deepEqual(selected?.request,{action:'chat',query:''},question);
 }
 for(const question of ['Say hello using my saved notes.','Say hello in one short sentence and save it.','Say hello, then search my files.','Say hello based on our previous conversation.'])assert.equal(contextIndependentConversation(question,[],context),null,question);
 assert.equal(contextIndependentConversation('Say hello in one short sentence.',[{name:'a.txt',kind:'text',status:'Text available'}],context),null);
});

test('one-sentence formatting accepts shortness modifiers without limiting ordinary or long requests',()=>{
 for(const question of ['Say hello in one short sentence.','Explain rain in a single brief sentence.','Respond in exactly one concise sentence.']){
  assert.equal(requestsOneSentence(question),true,question);
  assert.deepEqual(dialogueOutputLimits('detailed',question,8192),{total:256,segment:256});
 }
 assert.equal(requestsOneSentence('Write two short sentences.'),false);
 assert.deepEqual(dialogueOutputLimits('balanced','Explain the atmosphere.',8192),{total:8192,segment:8192});
 assert.deepEqual(dialogueOutputLimits('balanced','Write one short sentence, then explain in detail.',8192),{total:8192,segment:8192});
});

test('native conversation completion includes its answer and retains dialogue without a second generation',async()=>{
 let calls=0,observed;
 const history={...context,recent:[{id:'earlier',user:'My favorite color is blue.',answer:'I will keep that in mind.'}],turnCount:1};
 const before=structuredClone(history);
 const runtime={...engine({action:'chat',reply}),generate:async(messages,_limit,format)=>{calls++;observed={messages,format};return {text:JSON.stringify({action:'chat',reply}),finishReason:'stop'};}};
 const plan=await planDialogue(runtime,'Why does that color appear in the daytime sky?',history,[],{allowedTools:[],history:[]});
 assert.equal(calls,1);assert.deepEqual(plan,{action:'chat',query:'',reply:{answer:reply.answer,sources:[]}});
 const chat=observed.format.tools.find(tool=>tool.function.name==='finish_chat');
 assert.ok(chat.function.parameters.required.includes('reply'));
 assert.equal(chat.function.parameters.properties.reply.properties.sources.maxItems,0);
 assert.ok(observed.messages.some(message=>message.role==='user'&&message.content.includes('My favorite color is blue.')));
 assert.deepEqual(history,before);
 const delivered=await groundedAnswer({store:{all:noWork,search:noWork},engine:{manifest,count:noWork,generate:noWork}},{model:'test',question:'Why does that color appear in the daytime sky?',mode:'chat',scope:{kind:'conversation'},context:history,reply:plan.reply});
 assert.equal(delivered.answer,reply.answer);assert.deepEqual(delivered.sources,[]);
});

test('native conversation reply cannot replace file, attachment, tool evidence or incomplete output',async()=>{
 const question='Explain the blue sky.';
 const plan=(value,extraContext=context,attachments=[],agent={allowedTools:[],history:[]},overrides={})=>planDialogue({...engine(value),...overrides},question,extraContext,attachments,agent);
 await assert.rejects(plan({action:'chat',reply:{...reply,sources:['S1']}}),error=>error.diagnostic.reason==='terminal reply sources');
 await assert.rejects(plan({action:'chat',reply},{...context,currentFile:{noteId:'file',revision:1}}),error=>error.diagnostic.reason==='terminal reply scope');
 await assert.rejects(plan({action:'chat',reply},context,[{name:'a.txt',kind:'text',status:'Text available'}]),error=>error.diagnostic.reason==='terminal reply scope');
 await assert.rejects(plan({action:'chat',reply},context,[],{allowedTools:[],history:[{tool:'memory.search',arguments:{query:'sky'},result:[]}]}),error=>error.diagnostic.reason==='agent final action');
 await assert.rejects(plan({action:'chat',reply},context,[],undefined,{generate:async()=>({text:JSON.stringify({action:'chat',reply}),finishReason:'length'})}),error=>error.diagnostic.reason==='terminal reply incomplete');
 await assert.rejects(plan({action:'chat',reply},context,[],undefined,{generate:async()=>({text:JSON.stringify({action:'chat',reply}),outputTokens:40,outputTokenLimit:40})}),error=>error.diagnostic.reason==='terminal reply incomplete');
 await assert.rejects(plan({action:'chat',reply},context,[],undefined,{plannerProtocol:'json'}),error=>error.diagnostic.reason==='terminal reply scope');
 await assert.rejects(plan({action:'chat',reply,target:'knowledge'}),error=>error.diagnostic.reason==='terminal reply scope');
 await assert.rejects(plan({action:'answer',reply}),error=>error.diagnostic.reason==='terminal reply scope','unsearched knowledge answers stay forbidden');
 const scope={inputs:false,file:false,current:false,historyCount:0};
 assert.equal(nativeFinalPlanTools(scope,['S1']).find(tool=>tool.function.name==='finish_chat').function.parameters.properties.reply.properties.sources.maxItems,0,'conversation schema never offers source labels');
 assert.ok(!nativeFinalPlanTools(scope,[],true).some(tool=>tool.function.name==='finish_chat'));
 for(const scoped of [{...scope,file:true},{...scope,inputs:true}])assert.equal(nativeFinalPlanTools(scoped).find(tool=>tool.function.name==='finish_chat')?.function.parameters.properties.reply,undefined);
});

test('terminal conversation delivery rechecks empty citations and safe complete user-facing text',async()=>{
 const deliver=(replacement,extra={})=>groundedAnswer({store:{all:noWork,search:noWork},engine:{manifest,count:noWork,generate:noWork}},{model:'test',question:'Explain rain in one short sentence.',mode:'chat',scope:{kind:'conversation'},reply:replacement,...extra});
 await assert.rejects(deliver({...reply,sources:[{noteId:'invented',revision:1,start:0,end:1,quote:'x'}]}));
 await assert.rejects(deliver({...reply,webSources:[{}]}));
 await assert.rejects(deliver({...reply,answer:'Rain falls. Clouds form.'}),/One sentence requested/);
 await assert.rejects(deliver({...reply,answer:'The answer comes from memory.read.'}));
 await assert.rejects(deliver(reply,{toolEvidence:{used:true,refs:[]}}),/Conflicting tool evidence scope/);
 await assert.rejects(deliver(reply,{check:()=>{throw Error('Stopped');}}),/Stopped/);
});

test('native conversation preserves a complete long response within the selected context',async()=>{
 const answer=Array.from({length:80},(_,index)=>`Example ${index+1} explains a different aspect of the atmosphere.`).join('\n');
 const plan=await planDialogue(engine({action:'chat',reply:{status:'answered',answer,sources:[]}}),'Explain the atmosphere in detail.',context,[],{allowedTools:[],history:[]});
 assert.equal(plan.reply.answer,answer);
 const result=await groundedAnswer({store:{all:noWork,search:noWork},engine:{manifest,count:noWork,generate:noWork}},{model:'test',question:'Explain the atmosphere in detail.',mode:'chat',scope:{kind:'conversation'},reply:plan.reply});
 assert.equal(result.answer,answer);
});
