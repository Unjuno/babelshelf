import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {configureStreamingSHA256,streamingSHA256Backend} from '../dist/streaming-sha256.js';
import {hashLocalModel} from '../dist/local-models.js';

test('the actual WASM backend hashes independent concurrent streams with identical SHA-256',async()=>{
 await import('../design/prototype/src/fast-hash.ts');
 const a=new Uint8Array(1048581).fill(17),b=new Uint8Array(160007).map((_,i)=>i%251);
 try{const result=await Promise.all([hashLocalModel(new Blob([a])),hashLocalModel(new Blob([b]))]);assert.deepEqual(result,[a,b].map(bytes=>createHash('sha256').update(bytes).digest('hex')));assert.equal(streamingSHA256Backend(),'hash-wasm-4.12.0');
  const controller=new AbortController(),chunk=new Uint8Array(65536);let reads=0,cancelled=false,released=false;
  const file={size:32*1024*1024,stream:()=>({getReader:()=>({async read(){return ++reads<=512?{done:false,value:chunk}:{done:true};},async cancel(){cancelled=true;},releaseLock(){released=true;}})})};
  const timer=setTimeout(()=>controller.abort(),0);try{await assert.rejects(hashLocalModel(file,{signal:controller.signal}),{name:'AbortError'});assert.ok(reads<512&&cancelled&&released);}finally{clearTimeout(timer);}
 }finally{configureStreamingSHA256(null);}
});

test('unavailable or incorrect acceleration falls back before reading, never skips verification',async()=>{
 for(const factory of [async()=>{throw Error('WASM unavailable');},async()=>({update(){},hex(){return 'f'.repeat(64);}})]){
  configureStreamingSHA256(factory,'broken');
  assert.equal(await hashLocalModel(new Blob(['unaltered input'])),createHash('sha256').update('unaltered input').digest('hex'));assert.equal(streamingSHA256Backend(),'javascript');
 }
 configureStreamingSHA256(null);
});
