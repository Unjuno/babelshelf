import test from 'node:test';import assert from 'node:assert/strict';
import {searchResultRows,searchDisplayStatus} from '../src/search-display.ts';
test('ranked passages from the same file/version use one exact source row without mutating retained hits',()=>{const first={noteId:'task',revision:2,start:40,end:60,quote:'scheduled prompt'},original={noteId:'note',revision:2,start:0,end:12,quote:'water: 24 L'},later={noteId:'task',revision:2,start:0,end:10,quote:'metadata'};const hits=[first,original,later],snapshot=structuredClone(hits);assert.deepEqual(searchResultRows(hits),[first,original]);assert.strictEqual(searchResultRows(hits)[0],first);assert.deepEqual(hits,snapshot);assert.equal(searchDisplayStatus('Found · 3',hits,[]),'Found · 2');});
test('different identities and historical versions stay separate; other operation states remain exact',()=>{const hits=[{noteId:'a',revision:1,quote:'same'},{noteId:'a',revision:2,quote:'same'},{noteId:'b',revision:1,quote:'same'}];assert.equal(searchResultRows(hits).length,3);assert.equal(searchDisplayStatus('Found · 4',hits,[{noteId:'raw'}]),'Found · 4');assert.equal(searchDisplayStatus('Stopped',hits,[]),'Stopped');assert.equal(searchDisplayStatus(undefined,hits,[]),undefined);assert.deepEqual(searchResultRows(undefined),[]);});
test('empty search uses a label that covers both notes and files',()=>{assert.equal(searchDisplayStatus('No matching notes',[],[]),'No matches');});

import {mergeStoredSearchResults} from '../src/file-discovery.ts';
import {KnowledgeStore} from '../src/knowledge-store.ts';
import {createNote} from '../../../dist/core.js';
test('stored discovery mixes metadata and passages without duplicating files or converting metadata into evidence',()=>{
 const files=Array.from({length:12},(_,i)=>({kind:'file',noteId:`f${i}`,revision:1,path:`Inbox/water-${i}.md`}));
 const passage={noteId:'body',revision:1,start:0,end:5,quote:'water',score:1};const same={noteId:'f0',revision:1,start:0,end:5,quote:'water',score:2};const before=structuredClone({files,passages:[same,passage]});
 const result=mergeStoredSearchResults(files,[same,passage]);assert.equal(result.length,12);assert.ok(result.includes(passage));assert.deepEqual(result[0],{...same,path:files[0].path});assert.equal(result.filter(item=>item.noteId==='f0').length,1);assert.ok(result.some(item=>item.kind==='file'));assert.deepEqual({files,passages:[same,passage]},before);
 assert.deepEqual(mergeStoredSearchResults([], [passage]),[passage]);assert.deepEqual(mergeStoredSearchResults([files[0]],[]),[files[0]]);
});
test('an exact saved path keeps the target and literal references, not unrelated word matches',()=>{
 const file={kind:'file',noteId:'target',revision:1,path:'Tools/README.md'};
 const passages=[{noteId:'unrelated',revision:1,quote:'Tools and another README'}, {noteId:'target',revision:1,quote:'# Tools'}, {noteId:'reference',revision:1,quote:'See Tools/README.md for the details.'}];
 const found=mergeStoredSearchResults([file],passages,12,'Tools/README.md');
 assert.deepEqual(found.map(item=>item.noteId),['target','reference']);
 assert.deepEqual(mergeStoredSearchResults([file],passages,12,'Tools').map(item=>item.noteId),['target','unrelated','reference']);
 assert.deepEqual(mergeStoredSearchResults([file],passages,12,'Ｔｏｏｌｓ/ＲＥＡＤＭＥ．ｍｄ').map(item=>item.noteId),['target','reference']);
 assert.deepEqual(mergeStoredSearchResults([file],passages,12,'Tools/not-found.md').map(item=>item.noteId),['target','unrelated','reference']);
});
test('stored discovery finds a reference split at a passage boundary with its original range',async()=>{
 const path='Tools/README.md',target=createNote({path,body:'# Tools'}),body='あ'.repeat(693)+path+' details',ref=createNote({path:'Notes/reference.md',body});
 const result=await KnowledgeStore.prototype.search.call({all:async()=>[target,ref]},path,true);
 assert.ok(result.some(item=>item.noteId===target.id));
 const hit=result.find(item=>item.noteId===ref.id);
 assert.ok(hit?.quote.includes(path));
 assert.equal(body.slice(hit.start,hit.end),hit.quote);
});

test('a bare exact filename finds the original files instead of previous answers mentioning that name',async()=>{
 const first=createNote({path:'Inbox/Test-reserve.md',body:'集合場所は青葉図書館。飲料水は17リットル。'});
 const other=createNote({path:'Notes/Test-reserve.md',body:'A distinct file with the same basename.'});
 const comparison=createNote({path:'Inbox/comparison.md',body:'Test-reserve.md contains seventeen litres. Test-reserve-second.md contains nine litres.'});
 const records=[comparison,first,other],before=structuredClone(records);
 const search=query=>KnowledgeStore.prototype.search.call({all:async()=>records},query,true);
 const exact=await search('Test-reserve.md');
 assert.deepEqual(new Set(exact.map(item=>item.noteId)),new Set([first.id,other.id]));
 assert.ok(!exact.some(item=>item.noteId===comparison.id),'an answer that merely names the file is not the named original');
 assert.equal((await search('references to Test-reserve.md')).some(item=>item.noteId===comparison.id),true,'explicit reference/content search remains available');
 assert.equal((await search('Test-reserve-second.md')).some(item=>item.noteId===comparison.id),true,'without an exact file there is no guessed selector');
 assert.deepEqual(records,before);
});

test('exact file discovery retains canonical paths on passages without inventing paths for another revision',async()=>{
 const file=createNote({title:'source',path:'Inbox/source.md',body:'Original text.'});
 const rows=await KnowledgeStore.prototype.search.call({all:async()=>[file]},'source.md',true);
 assert.equal(rows[0].title,'source');assert.equal(rows[0].path,'Inbox/source.md');assert.equal(rows[0].quote,'Original text.');
 const older={noteId:file.id,revision:0,start:0,end:3,quote:'old',score:1};
 const [unjoined]=mergeStoredSearchResults([{kind:'file',noteId:file.id,revision:1,path:'Inbox/source.md'}],[older]);
 assert.equal(unjoined.path,undefined,'a current path must not be joined to a different revision');
});
