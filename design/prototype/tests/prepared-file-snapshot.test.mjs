import test from 'node:test';
import assert from 'node:assert/strict';
import {createRecentPreparedFileReader} from '../src/prepared-file-snapshot.ts';

test('prepared model reader reuses only the latest immutable File snapshot',async()=>{
 const pins={a:'a'.repeat(64),b:'b'.repeat(64)},files={a:new File(['a'],pins.a),b:new File(['b'],pins.b)},calls=[];
 const read=createRecentPreparedFileReader(async id=>{calls.push(id);if(id==='missing')throw Error('Missing');return files[id];},id=>id==='missing'?'missing-pin':pins[id],()=>1);
 assert.equal(await read('a'),files.a);assert.equal(await read('a'),files.a);assert.deepEqual(calls,['a']);
 assert.equal(await read('b'),files.b);await assert.rejects(read('missing'),/Missing/);
 assert.equal(await read('b'),files.b);assert.deepEqual(calls,['a','b','missing']);
 assert.equal(await read('a'),files.a);assert.deepEqual(calls,['a','b','missing','a']);
});

test('prepared reader rejects wrong content-addressed path or byte size before granting trust',async()=>{
 const digest='c'.repeat(64),wrongName=createRecentPreparedFileReader(async()=>new File(['x'],`${digest}.gguf`),()=>digest,()=>1);
 await assert.rejects(wrongName('model'),/identity mismatch/);
 const wrongSize=createRecentPreparedFileReader(async()=>new File(['xx'],digest),()=>digest,()=>1);
 await assert.rejects(wrongSize('model'),/size mismatch/);
});
test('a reused model snapshot must match the current declared size',async()=>{
 const digest='d'.repeat(64),file=new File(['x'],digest);let size=1,reads=0;
 const read=createRecentPreparedFileReader(async()=>{reads++;return file;},()=>digest,()=>size);
 assert.equal(await read('model'),file);size=2;
 await assert.rejects(read('model'),/size mismatch/);assert.equal(reads,1);
 size=1;assert.equal(await read('model'),file);assert.equal(reads,1);
});
