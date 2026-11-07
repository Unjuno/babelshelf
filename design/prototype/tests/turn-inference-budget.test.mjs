import test from 'node:test';
import assert from 'node:assert/strict';
import {createTurnInferenceBudget,TurnInferenceBudgetError} from '../src/turn-inference-budget.ts';

function engine(generate,extras={}){return {manifest:{contextTokens:8192},count:async()=>({prompt_tokens:0}),generate,...extras};}

test('one output-token budget is shared across pinned planning and final-answer engine views',async()=>{
 const calls=[],base=engine(async(_messages,maxTokens)=>{calls.push(maxTokens);return {text:'ok',outputTokens:maxTokens};},{pin(){return engine(this.generate);}});
 const budget=createTurnInferenceBudget({maxGenerationTokens:256,maxGenerationMs:null}),pinned=budget.wrap(base),first=await pinned.generate([],200);
 assert.equal(first.text,'ok');assert.equal(budget.generatedTokens,200);
 const second=await pinned.pin().generate([],100);assert.equal(second.outputTokens,56);assert.equal(second.outputTokenLimit,56);assert.equal(budget.generatedTokens,256);
 await assert.rejects(pinned.generate([],1),error=>error instanceof TurnInferenceBudgetError&&error.cause==='tokens');
 assert.deepEqual(calls,[200,56]);
});

test('an unreported token count reserves the requested allowance so retries cannot evade the cap',async()=>{
 const requested=[],wrapped=createTurnInferenceBudget({maxGenerationTokens:700,maxGenerationMs:null}).wrap(engine(async(_messages,maxTokens)=>{requested.push(maxTokens);return {text:'ok'};}));
 await wrapped.generate([],300);await wrapped.generate([],300);await wrapped.generate([],100);
 assert.deepEqual(requested,[300,300,100]);
 await assert.rejects(wrapped.generate([],1),error=>error instanceof TurnInferenceBudgetError&&error.cause==='tokens');
});

test('a completed generation exactly at the configured ceiling is returned and the next one is refused',async()=>{
 const wrapped=createTurnInferenceBudget({maxGenerationTokens:256,maxGenerationMs:null}).wrap(engine(async()=>({text:'complete',outputTokens:256})));
 assert.equal((await wrapped.generate([],256)).text,'complete');
 await assert.rejects(wrapped.generate([],1),error=>error instanceof TurnInferenceBudgetError&&error.cause==='tokens');
});

test('elapsed-time expiry stops in-flight inference and reports the budget boundary',async()=>{
 let expire,stopCount=0,rejectGeneration;
 const timers={set(callback){expire=callback;return 1;},clear(){}};
 const base=engine(()=>new Promise((_,reject)=>{rejectGeneration=reject;}),{stop(){stopCount++;rejectGeneration?.(Error('Stopped'));}});
 const wrapped=createTurnInferenceBudget({maxGenerationTokens:null,maxGenerationMs:1000,timers}).wrap(base),pending=wrapped.generate([],256);
 await new Promise(resolve=>setImmediate(resolve));expire();
 await assert.rejects(pending,error=>error instanceof TurnInferenceBudgetError&&error.cause==='time');
 assert.equal(stopCount,1);
});

test('an unconfigured profile stays unlimited and records elapsed generation time',async()=>{
 let now=0;
 const budget=createTurnInferenceBudget({maxGenerationTokens:null,maxGenerationMs:null,now:()=>now});
 const wrapped=budget.wrap(engine(async()=>{now+=50;return {text:'ok',outputTokens:7};}));
 await wrapped.generate([],32);await wrapped.generate([],32);
 assert.equal(budget.generatedTokens,14);assert.equal(budget.generationMs,100);
});

test('invalid profile generation budgets are rejected before wrapping an engine',()=>{
 for(const options of [{maxGenerationTokens:255,maxGenerationMs:null},{maxGenerationTokens:null,maxGenerationMs:999},{maxGenerationTokens:131073,maxGenerationMs:null}])assert.throws(()=>createTurnInferenceBudget(options),/Invalid generation budget/);
});


test('late streaming previews are suppressed while a timed-out runtime settles',async()=>{
 for(const fireTimer of [false,true]){
  let time=0,expire,emit,finish;const previews=[];
  const wrapped=createTurnInferenceBudget({maxGenerationTokens:null,maxGenerationMs:1000,now:()=>time,timers:{set(callback){expire=callback;return 1;},clear(){}}}).wrap(engine((_m,_n,_f,preview)=>{emit=preview;return new Promise(resolve=>{finish=resolve;});},{stop(){}}));
  const pending=wrapped.generate([],32,undefined,value=>previews.push(value));
  emit('early');time=1001;if(fireTimer)expire();emit('late');
  finish({text:'late final',outputTokens:2});
  await assert.rejects(pending,TurnInferenceBudgetError);
  assert.deepEqual(previews,['early']);
 }
});


test('a delayed deadline timer still classifies a late runtime rejection by elapsed time',async()=>{
 for(const elapsed of [999,1001]){
  let time=0,cleared=0;const failure=Error('Runtime failed');
  const budget=createTurnInferenceBudget({maxGenerationTokens:null,maxGenerationMs:1000,now:()=>time,timers:{set(){return 1;},clear(){cleared++;}}});
  const wrapped=budget.wrap(engine(async()=>{time=elapsed;throw failure;}));
  await assert.rejects(wrapped.generate([],32),error=>elapsed>1000?error instanceof TurnInferenceBudgetError&&error.cause==='time':error===failure);
  assert.equal(budget.generationMs,elapsed);assert.equal(budget.generatedTokens,32);assert.equal(cleared,1);
 }
});


test('concurrent pinned/model views cannot double-spend a shared budget or replace its deadline',async()=>{
 let finish,expire,stops=0,clears=0,calls=0;
 const budget=createTurnInferenceBudget({maxGenerationTokens:256,maxGenerationMs:1000,timers:{set(callback){expire=callback;return 1;},clear(){clears++;}}});
 const first=budget.wrap(engine(()=>{calls++;return new Promise(resolve=>{finish=resolve;});},{stop(){stops++;}}));
 const second=budget.wrap(engine(async()=>{calls++;return {text:'unexpected',outputTokens:200};}));
 const pending=first.pin().generate([],200);
 await assert.rejects(second.generate([],200),/Generation already running/);
 assert.equal(calls,1);assert.equal(budget.generatedTokens,0);
 expire();assert.equal(stops,1);
 finish({text:'late',outputTokens:12});
 await assert.rejects(pending,error=>error instanceof TurnInferenceBudgetError&&error.cause==='time');
 assert.equal(clears,1);assert.equal(budget.generatedTokens,12);
});

test('a delayed deadline from a completed generation cannot stop the next generation',async()=>{
 let time=0,nextTimer=0,stopCount=0,finishSecond;const callbacks=new Map(),cleared=[];
 const timers={set(callback){const id=++nextTimer;callbacks.set(id,callback);return id;},clear(id){cleared.push(id);}};
 const base=engine(async(_messages,_maxTokens)=>{
  if(nextTimer===1){time+=10;return {text:'first',outputTokens:1};}
  return new Promise(resolve=>{finishSecond=resolve;});
 },{stop(){stopCount++;}});
 const budget=createTurnInferenceBudget({maxGenerationTokens:null,maxGenerationMs:1000,now:()=>time,timers}),wrapped=budget.wrap(base);
 assert.equal((await wrapped.generate([],32)).text,'first');assert.deepEqual(cleared,[1]);
 const pending=wrapped.generate([],32);await new Promise(resolve=>setImmediate(resolve));
 callbacks.get(1)();
 assert.equal(stopCount,0,'the stale first deadline must not stop the active second generation');
 finishSecond({text:'second',outputTokens:1});assert.equal((await pending).text,'second');
 assert.equal(budget.generationMs,10);assert.equal(budget.generatedTokens,2);
});

test('the generation slot is released after a runtime failure without losing its charged allowance',async()=>{
 const budget=createTurnInferenceBudget({maxGenerationTokens:256,maxGenerationMs:null});
 await assert.rejects(budget.wrap(engine(async()=>{throw Error('Runtime failed');})).generate([],200),/Runtime failed/);
 const limits=[];
 const result=await budget.wrap(engine(async(_messages,maxTokens)=>{limits.push(maxTokens);return {text:'retry',outputTokens:10};})).generate([],100);
 assert.equal(result.text,'retry');assert.deepEqual(limits,[56]);assert.equal(budget.generatedTokens,210);
});

test('an asynchronous stop failure is handled while the timed-out generation remains rejected',async()=>{
 let expire,finish;
 const wrapped=createTurnInferenceBudget({maxGenerationTokens:null,maxGenerationMs:1000,timers:{
  set(callback){expire=callback;return 1;},clear(){},
 }}).wrap(engine(()=>new Promise(resolve=>{finish=resolve;}),{
  stop(){return Promise.reject(Error('Worker shutdown failed asynchronously'));}
 }));
 const pending=wrapped.generate([],64);
 expire();
 finish({text:'Late model reply',outputTokens:1});
 await assert.rejects(pending,error=>error instanceof TurnInferenceBudgetError&&error.cause==='time');
 // Let the stop promise settle; node:test will fail on an unhandled rejection.
 await new Promise(resolve=>setImmediate(resolve));
});
