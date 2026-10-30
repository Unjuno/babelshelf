import test from 'node:test';
import assert from 'node:assert/strict';
import {run} from '../src/tools/memory.read/tool.ts';
import {resolveToolNotes} from '../src/tools/tool-host.ts';

test('a continued read detects a changed revision instead of combining versions',async()=>{
 let notes=[{id:'one',path:'Notes/one.md',version:1,body:'Original text'}];
 const host={check(){},resolve:async query=>resolveToolNotes(notes,query)};
 const first=await run({query:'one',start:0,length:8},host);assert.equal(first[0].version,1);
 assert.equal((await run({query:'one',start:8,length:4,expectedRevision:1},host))[0].body,' tex');
 notes=[{...notes[0],version:2,body:'Updated text'}];
 await assert.rejects(run({query:'one',start:8,length:4,expectedRevision:first[0].version},host),/revision.*changed/i);
 notes=[];await assert.rejects(run({query:'one',expectedRevision:1},host),/revision.*changed/i);
});
