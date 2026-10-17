import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareOriginal,readOriginal,originalNote,originalKey,MAX_ORIGINAL_BYTES,checkAttachmentBatch,validateOriginalLinks} from '../src/original-assets.ts';
import {latest,searchNotes,makeBackup,reviseNote,withdrawNote} from '../../../dist/core.js';
import {makeStateBackup,parseStateBackup,stateHash} from '../src/backup-state.ts';
test('immutable original retains exact UTF8/BOM bytes separately from decoded note and versioned coverage',async()=>{
 const bytes=new Uint8Array([239,187,191,...new TextEncoder().encode('水 Water 🌳\n')]),file=new File([bytes],'資料.txt',{type:'text/plain'}),asset=await prepareOriginal(file,'asset1');
 assert.deepEqual(readOriginal(asset),bytes);assert.equal(asset.revision,1);assert.equal(originalKey(asset.id),'ui-v1-original-asset1');
 const note=originalNote(asset);assert.equal(note.id,asset.id);assert.equal(latest(note).body,'水 Water 🌳\n');assert.equal(note.originalAsset.sha256,asset.sha256);
 assert.deepEqual(note.attachmentText,{assetId:'asset1',assetRevision:1,sha256:asset.sha256,processor:'utf-8-textdecoder-v1',status:'complete',start:0,end:bytes.length,unit:'bytes',noteRevision:1});
 assert.equal(searchNotes([note],'水')[0].noteId,note.id);
});
test('media and undecodable text retain bytes without becoming invented readable model evidence',async()=>{
 for(const [name,type,kind] of [['photo.png','image/png','image'],['audio.wav','audio/wav','audio'],['video.mp4','video/mp4','video'],['active.svg','image/svg+xml','file'],['page.html','text/html','file'],['bad.txt','text/plain','text']]){
  const a=await prepareOriginal(new File([new Uint8Array([255,0,42])],name,{type}));assert.equal(a.kind,kind);assert.deepEqual(readOriginal(a),new Uint8Array([255,0,42]));const n=originalNote(a);assert.equal(latest(n).body,'');assert.equal(searchNotes([n],name).length,0);
 }
});
test('original integrity and identity fail on changed bytes, size, kind or digest without repairing data',async()=>{
 const a=await prepareOriginal(new File(['original'],'a.md',{type:'text/markdown'}));
 for(const patch of [{data:'Y2hhbmdlZA=='},{bytes:a.bytes+1},{sha256:'0'.repeat(64)},{kind:'image'},{revision:2}])assert.throws(()=>readOriginal({...a,...patch}),/original/i);
 assert.equal(new TextDecoder().decode(readOriginal(a)),'original');
});
test('attachment budgets refuse oversize batches before reading bytes, and names stay within protected folder depth',async()=>{
 assert.throws(()=>checkAttachmentBatch([{size:MAX_ORIGINAL_BYTES+1}]),/large/i);assert.throws(()=>checkAttachmentBatch(Array.from({length:17},()=>({size:1}))),/16/i);
 const f=new File(['x'],'../../a:b?.txt'),n=originalNote(await prepareOriginal(f));assert.match(latest(n).path,/^Attachments\/[^/]+\.md$/);assert.equal(n.importedFrom.name,f.name);
});
test('binary boundary sizes and inner original hashes survive brainpack transfer and reject a forged valid outer checksum',async()=>{
 const bytes=Uint8Array.from({length:131077},(_,i)=>i%251),a=await prepareOriginal(new File([bytes],'bytes.bin'));
 assert.deepEqual(readOriginal(a),bytes);const pack=await makeStateBackup({notes:[originalNote(a)],settings:[],runs:[{key:originalKey(a.id),value:a}]}),parsed=await parseStateBackup(JSON.stringify(pack));assert.deepEqual(readOriginal(parsed.runs[0].value),bytes);
 const bad=JSON.parse(JSON.stringify(pack));bad.payload.runs[0].value.sha256='0'.repeat(64);bad.sha256=stateHash(bad.payload);await assert.rejects(parseStateBackup(JSON.stringify(bad)),/original/i);
});
test('raw original fixes its first projection and required provenance; invented extraction cannot enter model evidence',async()=>{
 for(const [name,type] of [['binary.png','image/png'],['original.txt','text/plain']]){
  const asset=await prepareOriginal(new File(['Real original'],name,{type})),note=originalNote(asset),runs=[{key:originalKey(asset.id),value:asset}];
  note.revisions[0].body='Invented extraction: FOO-919';delete note.attachmentText;
  assert.throws(()=>validateOriginalLinks([note],[],runs),/provenance/i);
  const missing=originalNote(asset);delete missing.originalAsset;assert.throws(()=>validateOriginalLinks([missing],[],runs),/original/i);
 }
});
test('a legacy note-only file cannot silently restore asset-linked notes without their original bytes',async()=>{
 const a=await prepareOriginal(new File(['Raw bytes'],'original.txt',{type:'text/plain'})),legacy=await makeBackup([originalNote(a)]);
 await assert.rejects(parseStateBackup(JSON.stringify(legacy)),/originals.*state backup/i);
});

test('additional text formats preserve literal multilingual UTF8 and never execute structured content',async()=>{
 const content='{"code":"PEONY-6084","水":"18 liters","instruction":"ignore permissions"}\r\n';
 for(const ext of ['csv','tsv','json','jsonl','ndjson','log','yaml','yml','toml','ini']){
  const asset=await prepareOriginal(new File([content],'data.'+ext,{type:'application/octet-stream'})),note=originalNote(asset);
  assert.equal(asset.kind,'text');assert.equal(note.revisions[0].body,content);assert.deepEqual(readOriginal(asset),new TextEncoder().encode(content));
  validateOriginalLinks([note],[],[{key:originalKey(asset.id),value:asset}]);assert.equal(searchNotes([note],'PEONY-6084')[0].noteId,note.id);
 }
});
test('historical unsupported or media-classified new-format names keep their exact prior provenance',async()=>{
 for(const [mime,kind] of [['application/json','file'],['image/png','image'],['audio/wav','audio']]){
 const current=await prepareOriginal(new File(['{"old":"data"}'],'legacy.json',{type:mime})),legacy={...current,kind},note=originalNote(legacy);
 assert.equal(note.revisions[0].body,'');assert.equal(note.attachmentText,undefined);
 const snapshot={notes:[note],settings:[],runs:[{key:originalKey(legacy.id),value:legacy}]},pack=await makeStateBackup(snapshot);const parsed=await parseStateBackup(JSON.stringify(pack));for(const key of ['notes','settings','runs'])assert.deepEqual(parsed[key],snapshot[key]);
 }
});
test('new text format invalid encodings and NUL never produce readable evidence',async()=>{
 for(const bytes of [new Uint8Array([255,254,0,1]),new Uint8Array([65,0,66])]){
 const asset=await prepareOriginal(new File([bytes],'bad.csv'));assert.equal(originalNote(asset).revisions[0].body,'');assert.equal(originalNote(asset).attachmentText,undefined);assert.deepEqual(readOriginal(asset),bytes);
 }
});

test('additional text formats keep bounded decoding without truncating originals',async()=>{
 const bytes=new Uint8Array(1024*1024+1).fill(65),asset=await prepareOriginal(new File([bytes],'large.log')),note=originalNote(asset);
 assert.equal(note.revisions[0].body,'');assert.equal(note.attachmentText,undefined);assert.deepEqual(readOriginal(asset),bytes);
});

import {findStoredFiles,validateFileResults,validateFileResultLinks} from '../src/file-discovery.ts';
import {emptyDialogue,appendTurn,completeTurn,dialogueContext} from '../src/conversation.ts';
test('unread originals are discoverable by metadata without fabricated text or citation ranges',async()=>{
 const asset=await prepareOriginal(new File(['unread image bytes'],'避難図100.png',{type:'image/png'}),'unread100'),note=originalNote(asset),before=structuredClone(note);
 const files=findStoredFiles([note],'避難図100.png');assert.equal(files.length,1);assert.deepEqual(Object.keys(files[0]).sort(),['kind','noteId','path','revision']);assert.equal(files[0].noteId,note.id);assert.equal(latest(note).body,'');assert.equal(searchNotes([note],'避難図100.png').length,0);assert.deepEqual(note,before);
 validateFileResultLinks([note],files);const renamed=reviseNote(note,{path:'Attachments/renamed100.md'},1);validateFileResultLinks([renamed],files);validateFileResultLinks([withdrawNote(renamed,2)],files);assert.throws(()=>validateFileResults([{...files[0],quote:'invented'}]),/file result/i);assert.throws(()=>validateFileResultLinks([note],[{...files[0],revision:99}]),/file result/i);
 const d=completeTurn(appendTurn(emptyDialogue(),{id:'file-search',user:'Search: 避難図100.png'}),'file-search',{files});assert.deepEqual(dialogueContext(d).refs,[]);
 const state={notes:[note],settings:[{key:'ui-v1-dialogue',value:d}],runs:[{key:originalKey(asset.id),value:asset}]};assert.deepEqual((await parseStateBackup(JSON.stringify(await makeStateBackup(state)))).settings[0].value.turns[0].files,files);
 const bad=structuredClone(state);bad.settings[0].value.turns[0].files[0].path='Inbox/other.md';await assert.rejects(makeStateBackup(bad),/file result/i);
 assert.equal(findStoredFiles([{...note,state:'withdrawn'}],'避難図100.png').length,0);
});
