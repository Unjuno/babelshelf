import test from 'node:test';import assert from 'node:assert/strict';
import {searchResultRows,searchDisplayStatus} from '../src/search-display.ts';
test('ranked passages from the same file/version use one exact source row without mutating retained hits',()=>{const first={noteId:'task',revision:2,start:40,end:60,quote:'scheduled prompt'},original={noteId:'note',revision:2,start:0,end:12,quote:'water: 24 L'},later={noteId:'task',revision:2,start:0,end:10,quote:'metadata'};const hits=[first,original,later],snapshot=structuredClone(hits);assert.deepEqual(searchResultRows(hits),[first,original]);assert.strictEqual(searchResultRows(hits)[0],first);assert.deepEqual(hits,snapshot);assert.equal(searchDisplayStatus('Found · 3',hits,[]),'Found · 2');});
test('different identities and historical versions stay separate; other operation states remain exact',()=>{const hits=[{noteId:'a',revision:1,quote:'same'},{noteId:'a',revision:2,quote:'same'},{noteId:'b',revision:1,quote:'same'}];assert.equal(searchResultRows(hits).length,3);assert.equal(searchDisplayStatus('Found · 4',hits,[{noteId:'raw'}]),'Found · 4');assert.equal(searchDisplayStatus('Stopped',hits,[]),'Stopped');assert.equal(searchDisplayStatus(undefined,hits,[]),undefined);assert.deepEqual(searchResultRows(undefined),[]);});

import {mergeStoredSearchResults} from '../src/file-discovery.ts';
test('stored discovery mixes metadata and passages without duplicating files or converting metadata into evidence',()=>{
 const files=Array.from({length:12},(_,i)=>({kind:'file',noteId:`f${i}`,revision:1,path:`Inbox/water-${i}.md`}));
 const passage={noteId:'body',revision:1,start:0,end:5,quote:'water',score:1};const same={noteId:'f0',revision:1,start:0,end:5,quote:'water',score:2};const before=structuredClone({files,passages:[same,passage]});
 const result=mergeStoredSearchResults(files,[same,passage]);assert.equal(result.length,12);assert.ok(result.includes(passage));assert.strictEqual(result[0],same);assert.equal(result.filter(item=>item.noteId==='f0').length,1);assert.ok(result.some(item=>item.kind==='file'));assert.deepEqual({files,passages:[same,passage]},before);
 assert.deepEqual(mergeStoredSearchResults([], [passage]),[passage]);assert.deepEqual(mergeStoredSearchResults([files[0]],[]),[files[0]]);
});
