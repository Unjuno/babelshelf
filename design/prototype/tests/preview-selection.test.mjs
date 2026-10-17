import test from 'node:test';
import assert from 'node:assert/strict';
import {PreviewSelection} from '../src/preview-selection.ts';
test('an older uncached original cannot replace a newer cached selection',async()=>{
 const selection=new PreviewSelection();let resolve;const old=selection.load(()=>new Promise(r=>resolve=r)),fresh=await selection.load(async()=>({name:'B'}));resolve({name:'A'});
 assert.equal(fresh.name,'B');assert.equal(await old,undefined);
});
test('navigation or sheet dismissal cancels pending preview and suppresses its obsolete error',async()=>{
 const selection=new PreviewSelection();let fail;const old=selection.load(()=>new Promise((_,r)=>fail=r));selection.cancel();fail(Error('Old missing asset'));assert.equal(await old,undefined);
 await assert.rejects(selection.load(async()=>{throw Error('Current missing asset');}),/Current missing/);
});
