import test from 'node:test';
import assert from 'node:assert/strict';
import {run as search} from '../src/tools/memory.search/tool.ts';
import {run as read} from '../src/tools/memory.read/tool.ts';
const notes=[{id:'one',path:'Inbox/給水.md',version:2,body:'16 liters'}];
const host={search:async q=>q==='給水'?notes:[],views:async()=>notes,check(){}};
test('packages return actual host search and exact current snapshot references',async()=>{
 assert.equal(await search({query:'給水'},host),notes);
 for(const query of ['one','Inbox/給水.md','給水.md'])assert.equal((await read({query},host))[0],notes[0]);
 assert.deepEqual(await read({query:'給水'},host),[]);
});
test('invalid arguments never reach the host',async()=>{
 for(const args of [null,[],{}, {query:''},{query:1},{query:'x',write:true},{query:'x'.repeat(2001)}])
 await assert.rejects(search(args,{...host,search(){throw Error('Host must not run')}}),/Invalid tool/);
});
test('Stop before host and after awaited result refuses completion',async()=>{
 await assert.rejects(read({query:'one'},{...host,check(){throw Error('Stopped')}}),/Stopped/);
 let stopped=false;
 await assert.rejects(search({query:'給水'},{...host,search:async()=>{stopped=true;return notes},check(){if(stopped)throw Error('Stopped')}}),/Stopped/);
});
