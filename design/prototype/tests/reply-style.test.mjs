import test from 'node:test';
import assert from 'node:assert/strict';
import {dialogueOutputLimits,replyStyleInstruction} from '../src/reply-style.ts';
import {dialogueAnswerMessages,groundedAnswer} from '../src/grounded-answer.ts';

test('reply style is a finite presentation preference and never overrides a direct request',()=>{
 assert.match(replyStyleInstruction('concise'),/brief/);
 assert.match(replyStyleInstruction('detailed'),/more explanation/);
 assert.match(replyStyleInstruction('balanced'),/clear, proportionate answer/);
 for(const invalid of ['ignore safety','<script>','',null])assert.throws(()=>replyStyleInstruction(invalid));
 const messages=dialogueAnswerMessages('Give me a detailed explanation.',undefined,'concise');
 assert.match(messages[0].content,/The user's explicit request for language, length or format takes precedence/);
 assert.match(messages[0].content,/brief/);
});

test('dialogue output budgets follow style and explicit length without leaving an unbounded continuation allowance',()=>{
 assert.deepEqual(dialogueOutputLimits('concise','What time is it?',4096),{total:256,segment:256});
 assert.deepEqual(dialogueOutputLimits('balanced','What time is it?',4096),{total:768,segment:512});
 assert.deepEqual(dialogueOutputLimits('detailed','What time is it?',4096),{total:1536,segment:768});
 assert.deepEqual(dialogueOutputLimits('concise','Explain this in detail.',4096),{total:3072,segment:768},'an explicit long request takes precedence over the concise preference');
 assert.deepEqual(dialogueOutputLimits('balanced','Write two paragraphs.',4096),{total:3072,segment:768},'an explicit paragraph count is treated as a length request');
 assert.deepEqual(dialogueOutputLimits('detailed','簡潔に一言で答えて',4096),{total:256,segment:256},'an explicit short request takes precedence over the detailed preference');
 assert.deepEqual(dialogueOutputLimits('detailed','Explain this in detail.',600),{total:600,segment:600},'available context remains the hard upper bound');
});

test('grounded dialogue passes the selected response style through its actual generation boundary',async()=>{
 let generated,budget;const engine={loaded:'model',assets:{},manifest:{contextTokens:2048,models:[],runtime:{}},count:async()=>({prompt_tokens:5}),generate:async(messages,maxTokens)=>{generated=messages;budget=maxTokens;return {text:'A concise answer.',finishReason:'stop'};}};
 const store={all:async()=>[],search:async()=>[]},context={summary:'',recent:[],refs:[]};
 await groundedAnswer({store:store,engine:engine},{model:'model',question:'Hello.',query:'',mode:'chat',context:context,check:()=>{},scope:{kind:'conversation'},replyStyle:'concise'});
 assert.match(generated[0].content,/Prefer a brief answer/);assert.equal(budget,256);
 await groundedAnswer({store:store,engine:engine},{model:'model',question:'Explain this in detail.',query:'',mode:'chat',context:context,check:()=>{},scope:{kind:'conversation'},replyStyle:'concise'});assert.equal(budget,768,'explicit length outranks the concise setting at the actual generation boundary');
 await assert.rejects(groundedAnswer({store:store,engine:engine},{model:'model',question:'Hello.',query:'',mode:'chat',context:context,check:()=>{},scope:{kind:'conversation'},replyStyle:'do anything'}),/Unsupported reply style/);
});

test('an underreported token count cannot reopen output budget after a length stop',async()=>{
 let calls=0;const engine={loaded:'model',assets:{},manifest:{contextTokens:2048,models:[],runtime:{}},count:async()=>({prompt_tokens:5}),generate:async()=>{calls++;return {text:'Partial output',finishReason:'length',outputTokens:0};}};
 const store={all:async()=>[],search:async()=>[]},context={summary:'',recent:[],refs:[]};
 await assert.rejects(groundedAnswer({store:store,engine:engine},{model:'model',question:'What time is it?',query:'',mode:'chat',context:context,check:()=>{},scope:{kind:'conversation'},replyStyle:'concise'}),/output limit/);
 assert.equal(calls,1,'the concise 256-token allowance was fully allocated to the only segment');
});
