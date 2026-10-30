import test from 'node:test';
import assert from 'node:assert/strict';
import {plannerContextFits} from '../src/dialogue-planner.ts';

test('native planner checks context after more than 64 successful tool discoveries',async()=>{
 const engine={plannerProtocol:'native-tool-calls',manifest:{contextTokens:65536},count:async()=>({prompt_tokens:1000})};
 const allowedTools=[{id:'tools.search',effect:'read',network:'none',usage:'Search tool descriptions.'}];
 const history=Array.from({length:65},(_,i)=>({tool:'tools.search',arguments:{query:`term-${i}`},result:[]}));
 assert.equal(await plannerContextFits(engine,'Find suitable tools',{summary:'',recent:[],refs:[],turnCount:0},[],{allowedTools,history}),true);
});

test('native planner still validates every observed tool result',async()=>{
 const engine={plannerProtocol:'native-tool-calls',manifest:{contextTokens:65536},count:async()=>({prompt_tokens:1000})};
 const allowedTools=[{id:'tools.read-skill',effect:'read',network:'none'}];
 const history=[{tool:'tools.read-skill',arguments:{id:'user.first'},result:{id:'user.first',title:'First',instructions:'Read.'}},{tool:'tools.read-skill',arguments:{id:'user.expected'},result:{id:'user.different',title:'Different',instructions:'Read.'}}];
 await assert.rejects(plannerContextFits(engine,'Find tools',{summary:'',recent:[],refs:[],turnCount:0},[],{allowedTools,history}),/identity changed/);
});
