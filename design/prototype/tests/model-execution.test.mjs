import test from 'node:test';import assert from 'node:assert/strict';
import {createModelExecutionManager,ModelPreparationRequired} from '../src/model-execution.ts';
function setup(){const events=[];let loaded='';let decisionLoaded=true;const text={get loaded(){return loaded;},busy:false,assets:{t:{filesPresent:true}},manifest:{models:[{id:'t',engine:'wllama-lfm2'}]},pin(){events.push('pin');return text;},async load(id){events.push('load:'+id);loaded=id;},async unload(){events.push('unload:text');loaded='';}};const decision={ready:true,enabled:true,get loaded(){return decisionLoaded;},set loaded(value){decisionLoaded=value;},busy:false,async load(){events.push('load:decision');decisionLoaded=true;return {loaded:true};},async unload(){events.push('unload:decision');decisionLoaded=false;}};const manager=createModelExecutionManager({text,decision,ensureRuntime:async(role,network)=>{events.push({role,network});}});return {manager,text,decision,events};}
test('automatic Text acquisition verifies local runtime and never acquires network assets',async()=>{const f=setup();assert.equal(await f.manager.text('t',()=>{}),f.text);assert.equal(f.events.filter(e=>e==='load:t').length,1);assert.deepEqual(f.events.find(e=>typeof e==='object'),{role:'text-wllama',network:false});});
test('missing files return a typed preparation requirement before evicting another resident',async()=>{const f=setup();f.text.assets.t.filesPresent=false;await assert.rejects(f.manager.text('t',()=>{}),e=>e instanceof ModelPreparationRequired&&e.reason==='model-files');assert.deepEqual(f.events,[]);});
test('resident Text is reused and only explicit Load can request runtime acquisition',async()=>{const f=setup();await f.manager.loadText('t',()=>{},{allowNetwork:true});assert.deepEqual(f.events.find(e=>typeof e==='object'),{role:'text-wllama',network:true});f.events.length=0;await f.manager.text('t',()=>{});assert.equal(f.events.includes('load:t'),false);assert.equal(f.events.filter(e=>typeof e==='object').length,0);});
test('resident Text lost while releasing Decision is rechecked locally before reloading',async()=>{
 const f=setup();await f.text.load('t');f.events.length=0;
 f.decision.unload=async()=>{f.events.push('unload:decision');f.decision.loaded=false;await f.text.unload();};
 await f.manager.text('t',()=>{});
 assert.deepEqual(f.events,['unload:decision','unload:text',{role:'text-wllama',network:false},'load:t','pin']);
});
test('busy competing inference is preserved; cancellation after release prevents Load',async()=>{const f=setup();f.decision.busy=true;await assert.rejects(f.manager.text('t',()=>{}),/busy/);assert.deepEqual(f.events,[{role:'text-wllama',network:false}]);f.decision.busy=false;let stopped=false;f.decision.unload=async()=>{stopped=true;};await assert.rejects(f.manager.text('t',()=>{if(stopped)throw Error('Stopped');}),/Stopped/);assert.equal(f.events.includes('load:t'),false);});
test('Decision runtime is checked before releasing the resident Text model',async()=>{const f=setup();f.decision.loaded=false;await f.text.load('t');f.events.length=0;assert.equal(await f.manager.decision(()=>{}),f.decision);assert.deepEqual(f.events,[{role:'decision',network:false},'unload:text','load:decision']);});
test('switching between selected Decision and Text roles evicts the idle model and a later switch must load it again',async()=>{
 const f=setup();f.decision.loaded=false;
 await f.manager.decision(()=>{});
 assert.equal(f.decision.loaded,true);
 f.events.length=0;
 await f.manager.text('t',()=>{});
 assert.equal(f.decision.loaded,false);assert.equal(f.text.loaded,'t');
 assert.deepEqual(f.events,[{role:'text-wllama',network:false},'unload:decision','load:t','pin']);
 f.events.length=0;
 await f.manager.decision(()=>{});
 assert.equal(f.text.loaded,'');assert.equal(f.decision.loaded,true);
 assert.deepEqual(f.events,[{role:'decision',network:false},'unload:text','load:decision']);
});
test('failed Text runtime verification preserves the resident Decision model and never retries through network',async()=>{const f=setup();f.decision.loaded=true;let calls=0;const manager=createModelExecutionManager({text:f.text,decision:f.decision,ensureRuntime:async(_role,network)=>{assert.equal(network,false);calls++;throw Error('Missing runtime');}});await assert.rejects(manager.text('t',()=>{}),/Missing runtime/);assert.equal(calls,1);assert.equal(f.events.includes('load:t'),false);assert.equal(f.events.includes('unload:decision'),false);assert.equal(f.decision.loaded,true);});
test('failed Decision runtime verification preserves the resident Text model',async()=>{const f=setup();f.decision.loaded=false;await f.text.load('t');f.events.length=0;const manager=createModelExecutionManager({text:f.text,decision:f.decision,ensureRuntime:async(role,network)=>{assert.equal(role,'decision');assert.equal(network,false);throw Error('Missing runtime');}});await assert.rejects(manager.decision(()=>{}),/Missing runtime/);assert.deepEqual(f.events,[]);assert.equal(f.text.loaded,'t');});

test('a resolved Load without an actual resident cannot claim successful Text or Decision loading',async()=>{
 const f=setup();f.text.load=async()=>{};await assert.rejects(f.manager.loadText('t',()=>{}),/did not load/);
 f.decision.loaded=false;f.decision.load=async()=>({loaded:false});await assert.rejects(f.manager.decision(()=>{}),/did not load/);
});
