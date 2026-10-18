import test from 'node:test';
import assert from 'node:assert/strict';
import {PreviewSelection} from '../src/preview-selection.ts';

test('concurrent original previews share one immutable read while retaining the newest selection',async()=>{
 const {createOriginalLoader}=await import('../src/original-loader.ts');let calls=0,resolve;
 const loader=createOriginalLoader(async pin=>{calls++;assert.equal(pin.sha256,'a'.repeat(64));return new Promise(r=>resolve=r);}),pin={id:'original',revision:1,sha256:'a'.repeat(64)},selection=new PreviewSelection();
 const first=selection.load(()=>loader.load(pin)),second=selection.load(()=>loader.load({...pin}));pin.sha256='b'.repeat(64);await Promise.resolve();assert.equal(calls,1);
 const item={url:'one-owned-url'};resolve(item);assert.equal(await first,undefined);assert.equal(await second,item);
});
test('failed shared original reads clear pending work and different pins never share results',async()=>{
 const {createOriginalLoader}=await import('../src/original-loader.ts');let calls=0;
 const loader=createOriginalLoader(async pin=>{if(++calls===1)throw Error('Original unavailable');return {...pin};}),a={id:'original',revision:1,sha256:'a'.repeat(64)},b={...a,sha256:'b'.repeat(64)};
 const failed=loader.load(a);assert.equal(loader.load({...a}),failed);await assert.rejects(failed,/unavailable/);
 const [one,two]=await Promise.all([loader.load(a),loader.load(b)]);assert.equal(calls,3);assert.equal(one.sha256,a.sha256);assert.equal(two.sha256,b.sha256);
});
test('an older uncached original cannot replace a newer cached selection',async()=>{
 const selection=new PreviewSelection();let resolve;const old=selection.load(()=>new Promise(r=>resolve=r)),fresh=await selection.load(async()=>({name:'B'}));resolve({name:'A'});
 assert.equal(fresh.name,'B');assert.equal(await old,undefined);
});
test('navigation or sheet dismissal cancels pending preview and suppresses its obsolete error',async()=>{
 const selection=new PreviewSelection();let fail;const old=selection.load(()=>new Promise((_,r)=>fail=r));selection.cancel();fail(Error('Old missing asset'));assert.equal(await old,undefined);
 await assert.rejects(selection.load(async()=>{throw Error('Current missing asset');}),/Current missing/);
});
