import test from 'node:test';
import assert from 'node:assert/strict';
import {createDecisionSession} from '../src/decision-execution.ts';

test('Decision prefers WebGPU and uses WASM if GPU session creation fails',async()=>{
 const attempts=[],progress=[];const result=await createDecisionSession({preferred:'webgpu',create:async backend=>{attempts.push(backend);if(backend==='webgpu')throw Error('adapter cannot create this graph');return 'wasm-session';},check:()=>{},onFallback:()=>progress.push('fallback')});
 assert.deepEqual(attempts,['webgpu','wasm']);assert.deepEqual(progress,['fallback']);assert.deepEqual(result,{session:'wasm-session',device:'wasm',fellBack:true});
});

test('successful WebGPU session does not initialize a second backend',async()=>{
 const attempts=[];const result=await createDecisionSession({preferred:'webgpu',create:async backend=>{attempts.push(backend);return 'gpu-session';},check:()=>assert.fail('no fallback check'),onFallback:()=>assert.fail('must not fall back')});
 assert.deepEqual(attempts,['webgpu']);assert.deepEqual(result,{session:'gpu-session',device:'webgpu',fellBack:false});
});

test('a WASM-only browser creates one session without probing WebGPU',async()=>{
 const attempts=[];const result=await createDecisionSession({preferred:'wasm',create:async backend=>{attempts.push(backend);return 'wasm-session';},check:()=>{},onFallback:()=>assert.fail('already selected WASM')});
 assert.deepEqual(attempts,['wasm']);assert.equal(result.device,'wasm');assert.equal(result.fellBack,false);
});

test('Stop after a failed WebGPU creation remains terminal and never falls back',async()=>{
 let attempts=0,reported=false;await assert.rejects(createDecisionSession({preferred:'webgpu',create:async()=>{attempts++;throw Error('GPU init failed');},check:()=>{throw Error('Stopped');},onFallback:()=>{reported=true;}}),/Stopped/);
 assert.equal(attempts,1);assert.equal(reported,false);
});

test('WASM failure is reported without a third execution path',async()=>{
 const attempts=[];await assert.rejects(createDecisionSession({preferred:'webgpu',create:async backend=>{attempts.push(backend);throw Error(backend+' failed');},check:()=>{},onFallback:()=>{}}),/wasm failed/);assert.deepEqual(attempts,['webgpu','wasm']);
});
