import test from 'node:test';
import assert from 'node:assert/strict';
import {createRecentPreparedFileReader} from '../src/prepared-file-snapshot.ts';

test('prepared model reader reuses only the latest immutable File snapshot',async()=>{
 const files={a:new File(['a'],'a.gguf'),b:new File(['b'],'b.gguf')},calls=[];
 const read=createRecentPreparedFileReader(async id=>{calls.push(id);if(id==='missing')throw Error('Missing');return files[id];},id=>id==='missing'?'missing-pin':files[id]?.name??'');
 assert.equal(await read('a'),files.a);assert.equal(await read('a'),files.a);assert.deepEqual(calls,['a']);
 assert.equal(await read('b'),files.b);await assert.rejects(read('missing'),/Missing/);
 assert.equal(await read('b'),files.b);assert.deepEqual(calls,['a','b','missing']);
 assert.equal(await read('a'),files.a);assert.deepEqual(calls,['a','b','missing','a']);
});
