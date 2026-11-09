import test from 'node:test';
import assert from 'node:assert/strict';
import {chunkSemanticText,bindSemanticHits} from '../src/semantic-search-core.ts';

test('semantic chunks retain exact UTF-16 source ranges and bounded overlap',()=>{
 const body='Alpha paragraph.\n'+('A useful 🌱 fact appears here. '.repeat(24))+'\nLast line.';
 const chunks=chunkSemanticText({id:'note-a',version:3,title:'Garden',path:'Notes/garden.md',body},{maxChars:96,overlapChars:20});
 assert.ok(chunks.length>2);
 for(const chunk of chunks){
  assert.equal(chunk.text,body.slice(chunk.start,chunk.end));
  assert.ok(chunk.end>chunk.start);
  assert.ok(chunk.end-chunk.start<=96);
  assert.ok(!(chunk.start>0&&/^[\uDC00-\uDFFF]/u.test(body[chunk.start])));
  assert.ok(!(chunk.end<body.length&&/[\uD800-\uDBFF]$/u.test(body.slice(0,chunk.end))));
 }
 for(let i=1;i<chunks.length;i++)assert.ok(chunks[i].start<chunks[i-1].end&&chunks[i].start>=chunks[i-1].end-20);
 assert.equal(chunks[0].start,0);
 assert.equal(chunks.at(-1).end,body.length);
});

test('semantic hits bind only to exact text from the current canonical revision',()=>{
 const notes=[{id:'note-a',state:'active',path:'Notes/garden.md',revisions:[{version:1,title:'Old',body:'old text'},{version:2,title:'Garden',body:'A seedling needs light and water.'}]}];
 const result=bindSemanticHits(notes,[
  {noteId:'note-a',revision:2,start:0,end:33,quote:'A seedling needs light and water.',score:0.92},
  {noteId:'note-a',revision:2,start:0,end:33,quote:'A seedling needs light and water!',score:0.99},
  {noteId:'note-a',revision:1,start:0,end:8,quote:'old text',score:0.98},
  {noteId:'missing',revision:1,start:0,end:4,quote:'fake',score:0.97},
 ],{limit:5});
 assert.deepEqual(result,[{kind:'passage',noteId:'note-a',revision:2,title:'Garden',path:'Notes/garden.md',start:0,end:33,quote:'A seedling needs light and water.',score:0.92}]);
});

test('semantic hit scores, ranges and result budgets are validated before binding',()=>{
 const notes=[{id:'note-a',state:'active',path:'Notes/a.md',revisions:[{version:1,title:'A',body:'Exact source text.'}]}];
 const hits=[
  {noteId:'note-a',revision:1,start:0,end:18,quote:'Exact source text.',score:Infinity},
  {noteId:'note-a',revision:1,start:0,end:18,quote:'Exact source text.',score:-0.1},
  {noteId:'note-a',revision:1,start:-1,end:5,quote:'Exact',score:0.9},
  {noteId:'note-a',revision:1,start:0,end:18,quote:'Exact source text.',score:0.9},
  {noteId:'note-a',revision:1,start:0,end:18,quote:'Exact source text.',score:0.8},
 ];
 assert.equal(bindSemanticHits(notes,hits,{limit:1}).length,1);
 assert.equal(bindSemanticHits(notes,hits,{limit:1})[0].score,0.9);
 assert.throws(()=>bindSemanticHits(notes,hits,{limit:0}),/Invalid semantic search limit/);
});

test('semantic chunk configuration rejects unsafe bounds before reading text',()=>{
 const note={id:'note-a',version:1,title:'A',path:'Notes/a.md',body:'Some source text.'};
 assert.throws(()=>chunkSemanticText(note,{maxChars:16,overlapChars:2}),/Invalid semantic chunk options/);
 assert.throws(()=>chunkSemanticText(note,{maxChars:32,overlapChars:32}),/Invalid semantic chunk options/);
 assert.throws(()=>chunkSemanticText({...note,version:0}),/Invalid semantic note revision/);
});
