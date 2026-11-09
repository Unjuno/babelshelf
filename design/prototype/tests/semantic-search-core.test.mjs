import test from 'node:test';
import assert from 'node:assert/strict';
import {chunkSemanticText,rankSemanticVectors,bindSemanticHits} from '../src/semantic-search-core.ts';

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
 const notes=[{id:'note-a',state:'active',path:'Notes/garden.md',revisions:[{version:1,title:'Old',body:'old text'},{version:2,title:'Garden',body:'A seedling needs light and water.'}]},{id:'withdrawn',state:'withdrawn',revisions:[{version:1,title:'Withdrawn',body:'Withdrawn source.'}]},{id:'unknown-state',revisions:[{version:1,title:'Unknown state',body:'Unverified source.'}]}];
 const result=bindSemanticHits(notes,[
  {noteId:'note-a',revision:2,start:0,end:33,quote:'A seedling needs light and water.',score:0.92},
  {noteId:'note-a',revision:2,start:0,end:33,quote:'A seedling needs light and water!',score:0.99},
  {noteId:'note-a',revision:1,start:0,end:8,quote:'old text',score:0.98},
  {noteId:'withdrawn',revision:1,start:0,end:17,quote:'Withdrawn source.',score:0.99},
  {noteId:'unknown-state',revision:1,start:0,end:18,quote:'Unverified source.',score:0.98},
  {noteId:'missing',revision:1,start:0,end:4,quote:'fake',score:0.97},
 ],{limit:5});
 assert.deepEqual(result,[{kind:'passage',noteId:'note-a',revision:2,title:'Garden',path:'Notes/garden.md',start:0,end:33,quote:'A seedling needs light and water.',score:0.92}]);
});

test('semantic ranking uses only the selected embedding revision and normalized cosine order',()=>{
 const ranked=rankSemanticVectors([8,0],[
  {modelRevision:'embed-r1',noteId:'related',revision:2,start:0,end:7,quote:'Related',vector:[4,0]},
  {modelRevision:'embed-r1',noteId:'partial',revision:1,start:0,end:7,quote:'Partial',vector:[1,1]},
  {modelRevision:'embed-r0',noteId:'stale-model',revision:1,start:0,end:10,quote:'Stale model',vector:[1,0]},
  {modelRevision:'embed-r1',noteId:'invalid',revision:1,start:0,end:7,quote:'Invalid',vector:[Infinity,0]},
  {modelRevision:'embed-r1',noteId:'zero',revision:1,start:0,end:4,quote:'Zero',vector:[0,0]},
  {modelRevision:'embed-r1',noteId:'wrong-dimensions',revision:1,start:0,end:5,quote:'Wrong',vector:[1]},
 ],'embed-r1',{limit:4});
 assert.deepEqual(ranked.map(hit=>hit.noteId),['related','partial']);
 assert.equal(ranked[0].score,1);
 assert.ok(Math.abs(ranked[1].score-Math.SQRT1_2)<1e-12);
});

test('semantic ranking rejects unusable query vectors and invalid limits',()=>{
 const record={modelRevision:'embed-r1',noteId:'a',revision:1,start:0,end:4,quote:'Fact',vector:[1,0]};
 assert.deepEqual(rankSemanticVectors([0,0],[record],'embed-r1'),[]);
 assert.deepEqual(rankSemanticVectors([Infinity,0],[record],'embed-r1'),[]);
 assert.throws(()=>rankSemanticVectors([1,0],[record],'embed-r1',{limit:21}),/Invalid semantic ranking options/);
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
