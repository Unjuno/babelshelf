import test from 'node:test';
import assert from 'node:assert/strict';
const core=await import('../dist/core.js').catch(()=>({}));
test('new note preserves literal source and immutable revisions',()=>{
 assert.equal(typeof core.createNote,'function');
 const n=core.createNote({title:'設計',body:'<script>原文</script>\n\n予算は240万円。'});
 const v=core.reviseNote(n,{body:'予算を180万円に訂正。'},1);
 assert.equal(n.revisions.length,1);assert.equal(v.revisions.length,2);
 assert.equal(v.revisions[0].body,n.revisions[0].body);
 assert.throws(()=>core.reviseNote(v,{body:'競合'},1),/conflict/i);
});
test('Japanese search finds evidence beyond document beginning with exact UTF-16 ranges',()=>{
 assert.equal(typeof core.searchNotes,'function');
 const n=core.createNote({title:'長文',body:'背景の説明。\n\n'.repeat(200)+'🪴新幹線の予約番号は青葉742です。'});
 const hits=core.searchNotes([n],'青葉742');assert.ok(hits.length);
 const h=hits[0];assert.equal(n.revisions[0].body.slice(h.start,h.end),h.quote);assert.ok(h.start>1000);
});
test('withdrawn notes and derivatives with withdrawn sources cannot ground answers',()=>{
 const n=core.createNote({title:'計画',body:'会場は京都です。'});
 const ref=core.searchNotes([n],'会場')[0];
 const derived=core.createNote({title:'要約',body:'会場は京都。',kind:'generated',sources:[ref]});
 const w=core.withdrawNote(n,1);assert.equal(core.searchNotes([w,derived],'会場').length,0);
 assert.equal(core.validateRefs([w,derived],[ref]).ok,false);
});
test('forged, changed and out of bounds references are rejected',()=>{
 const n=core.createNote({title:'予定',body:'日時は10月20日。'});const ref=core.searchNotes([n],'日時')[0];
 assert.equal(core.validateRefs([n],[ref]).ok,true);
 for(const r of [{...ref,noteId:'missing'},{...ref,quote:'偽造'},{...ref,end:99999},{...ref,revision:9}])assert.equal(core.validateRefs([n],[r]).ok,false);
});
test('backup hash validates and restore is non-destructive including tombstones',async()=>{
 const n=core.createNote({title:'原本',body:'大切な記録'});const pack=await core.makeBackup([n]);
 assert.equal((await core.parseBackup(JSON.stringify(pack))).notes.length,1);
 const bad=structuredClone(pack);bad.payload.notes[0].revisions[0].body='改竄';await assert.rejects(()=>core.parseBackup(JSON.stringify(bad)));
 const changed=core.reviseNote(n,{body:'現行版'},1);const merged=core.mergeNotes([changed],[n]);assert.equal(merged.notes[0].revisions.length,2);assert.equal(merged.conflicts.length,1);
 const withdrawn=core.withdrawNote(n,1);assert.equal(core.mergeNotes([withdrawn],[n]).notes[0].state,'withdrawn');
});
test('explicit links never silently resolve duplicate titles',()=>{
 const a=core.createNote({title:'会議',body:'A'}),b=core.createNote({title:'会議',body:'B'});
 const c=core.createNote({title:'参照',body:`[[会議]] [[note:${a.id}]]`});
 const links=core.resolveLinks(c,[a,b,c]);assert.equal(links[0].status,'ambiguous');assert.equal(links[1].targetId,a.id);
});
test('tool allowlist rejects arbitrary code, destructive tools and unknown IDs',()=>{
 assert.equal(typeof core.validateTool,'function');
 assert.throws(()=>core.validateTool({name:'delete_note',arguments:{id:'a'}},[]));
 assert.throws(()=>core.validateTool({name:'read_note',arguments:{note_id:'missing'}},[]));
 assert.throws(()=>core.validateTool({name:'search_notes',arguments:{query:1}},[]));
 assert.equal(core.validateTool({name:'search_notes',arguments:{query:'京都',limit:5}},[]).name,'search_notes');
});
test('1000 Japanese notes preserve specific evidence recall and aliases',()=>{
 const notes=Array.from({length:1000},(_,i)=>core.createNote({title:`記録${i}`,body:`議事録。担当者は田中。識別語は試験${i}号。`,aliases:i===742?['青葉プロジェクト']:[]}));
 assert.equal(core.searchNotes(notes,'試験742号')[0].noteId,notes[742].id);
 assert.equal(core.searchNotes(notes,'青葉プロジェクト')[0].noteId,notes[742].id);
});
test('current Markdown filename remains searchable after rename without altering originals or citation spans',()=>{
 const original=core.createNote({title:'林檎会議',body:'集合場所は北口。',path:'Notes/林檎会議.md'}),renamed=core.reviseNote(original,{path:'Notes/避難案内.md'},1),before=structuredClone(renamed);
 for(const search of [core.searchNotes,core.searchStoredNotes]){
  const result=search([renamed],'避難案内');assert.equal(result[0]?.noteId,renamed.id);assert.equal(result[0].revision,2);assert.equal(renamed.revisions[1].body.slice(result[0].start,result[0].end),result[0].quote);
 }
 assert.equal(renamed.revisions[0].path,'Notes/林檎会議.md');assert.deepEqual(renamed,before);
});
test('Japanese English Chinese Korean and mixed input stay searchable',()=>{
 for(const [title,body,query] of [['ja','青葉会議の会場は京都です','青葉会議'],['en','The Aurora meeting room is Cedar Hall.','Aurora'],['zh','星河会议地点是上海。','星河会议'],['ko','새봄 회의 장소는 서울입니다.','새봄'],['mix','Aurora計画의 장소是京都。','Aurora計画']]){
  const n=core.createNote({title,body});assert.equal(core.searchNotes([n],query)[0]?.noteId,n.id);
 }
});
test('generated answer rejects missing or forged citation IDs and quotes',()=>{
 assert.equal(typeof core.parseAnswer,'function');const n=core.createNote({title:'予定',body:'会場は京都。'}),ref={...core.searchNotes([n],'会場')[0],label:'S1'};
 assert.equal(core.parseAnswer(JSON.stringify({answer:'京都です。',citations:[{id:'S1',quote:'京都'}]}),[ref]).answer,'京都です。');
 assert.throws(()=>core.parseAnswer(JSON.stringify({answer:'京都',citations:[{id:'S9',quote:'京都'}]}),[ref]));
 assert.throws(()=>core.parseAnswer(JSON.stringify({answer:'東京',citations:[{id:'S1',quote:'東京'}]}),[ref]));
 assert.throws(()=>core.parseAnswer(JSON.stringify({answer:'京都',citations:[]}),[ref]));
});


test('literal Latin words and identifiers do not retrieve incidental bigram overlaps',()=>{
 const wanted=core.createNote({body:'備蓄検証 CEDAR-8642\nWater reserve: 18 litres.'});
 const noise=core.createNote({body:'Offline Markdown HAZEL-3197. Restored independent MAPLE-4127.'});
 const prefix=core.createNote({body:'XCEDAR-8642 and CEDAR-86420 are different codes.'});
 const notes=[noise,prefix,wanted];
 assert.deepEqual(core.searchNotes(notes,'CEDAR-8642').map(h=>h.noteId),[wanted.id]);
 assert.deepEqual(core.searchNotes(notes,'ＣＥＤＡＲ－８６４２').map(h=>h.noteId),[wanted.id]);
 assert.deepEqual(core.searchNotes(notes,'reserve').map(h=>h.noteId),[wanted.id]);
 assert.equal(core.searchNotes(notes,'missing-9876').length,0);
 assert.equal(core.searchNotes(notes,'a').length,0);
 assert.deepEqual(core.searchNotes(notes,'Water CEDAR-8642').map(h=>h.noteId),[wanted.id]);
});
test('hybrid lexical search retains multilingual aliases and exact UTF-16 citation ranges',()=>{
 const n=core.createNote({body:'🪴備蓄。\n\n'.repeat(150)+'台帳 ABC_7294 を確認。',aliases:['Aurora Ledger']});
 const distractor=core.createNote({body:'台帳 ABC_72940 を確認。'});
 const h=core.searchNotes([distractor,n],'台帳 ABC_7294')[0];
 assert.equal(h.noteId,n.id);assert.ok(h.start>700);assert.equal(n.revisions[0].body.slice(h.start,h.end),h.quote);
 assert.equal(core.searchNotes([n],'Aurora')[0].noteId,n.id);
});

test('hybrid search retains single-character CJK recall and ignores punctuation-only overlap',()=>{
 const n=core.createNote({body:'飲料水を18リットル備蓄。白米は五キロ。Cats. Help?'});
 for(const query of ['水','米'])assert.equal(core.searchNotes([n],query)[0]?.noteId,n.id);
 for(const query of ['quux.','quux?'])assert.equal(core.searchNotes([n],query).length,0);
});
test('whole lexical tokens crossing fixed chunk boundaries remain searchable without partial-code evidence',()=>{
 for(const term of ['CEDAR-8642','aurora','ＣＥＤＡＲ－８６４２']){
  const n=core.createNote({body:'x'.repeat(695)+' '+term+' belongs here.'});
  const hits=core.searchNotes([n],term);assert.ok(hits.length,term);
  for(const h of hits){assert.ok(h.quote.includes(term));assert.equal(n.revisions[0].body.slice(h.start,h.end),h.quote);}
 }
 const n=core.createNote({body:'x'.repeat(695)+' CEDAR-8642 belongs here.'});
 assert.equal(core.searchNotes([n],'CEDA').length,0);
});

test('non-Latin combining marks stay with their script rather than matching as Latin words',()=>{
 for(const [query,body] of [['कला','माल'],['كَتَب','عَلَم']]){
  assert.equal(core.searchNotes([core.createNote({body})],query).length,0);
  const n=core.createNote({body:query});assert.equal(core.searchNotes([n],query)[0]?.noteId,n.id);
 }
 const n=core.createNote({body:'Café réserve'});assert.equal(core.searchNotes([n],'cafe\u0301')[0]?.noteId,n.id);
});

test('Unicode decimal identifiers are mandatory alongside non-Latin query text',()=>{
 const n=core.createNote({body:'試験١٢٣号'});
 assert.equal(core.searchNotes([n],'試験٩٩٩号').length,0);
 assert.equal(core.searchNotes([n],'試験١٢٣号')[0]?.noteId,n.id);
});

test('new grounded references require an eligible source chain while historical pins remain readable',()=>{
 const original=core.createNote({body:'original evidence'}),ref={noteId:original.id,revision:1,start:0,end:17,quote:'original evidence'},parent=core.createNote({body:'derived answer',kind:'generated',sources:[ref]}),pin={noteId:parent.id,revision:1,start:0,end:14,quote:'derived answer'};
 assert.equal(core.validateGroundingRefs([original,parent],[pin]).ok,true);
 for(const changed of [core.reviseNote(original,{body:'corrected evidence'},1),core.withdrawNote(original,1)]){
  const records=[changed,parent];assert.equal(core.validateRefs(records,[pin],{currentOnly:true}).ok,true);assert.equal(core.validateGroundingRefs(records,[pin]).ok,false);
  assert.throws(()=>core.validateTool({name:'create_note',arguments:{title:'new',body:'copy',source_refs:[pin]}},records),/sources/);
 }
 assert.equal(core.validateGroundingRefs([original,parent],[]).ok,true);
});

test('stored-note discovery finds reviewed unsourced and stale generated files without making them grounding evidence',()=>{
 const source=core.createNote({title:'Original',body:'The marker is CEDAR-2491.'});const ref=core.searchNotes([source],'CEDAR-2491')[0];
 const generated=core.createNote({title:'Saved summary',body:'CEDAR-2491 saved summary',kind:'generated',sources:[ref]}),calculation=core.createNote({title:'Calculation99',body:'(1200 + 800) / 4 = 500',kind:'generated',sources:[]});
 const corrected=core.reviseNote(source,{body:'The marker is MAPLE-2492.'},1),notes=[corrected,generated,calculation];
 assert.equal(core.searchNotes(notes,'Calculation99').length,0);assert.equal(core.searchNotes(notes,'CEDAR-2491').length,0);
 const found=core.searchStoredNotes(notes,'Calculation99');assert.equal(found[0].noteId,calculation.id);assert.equal(found[0].groundingEligible,false);
 const stale=core.searchStoredNotes(notes,'CEDAR-2491');assert.equal(stale[0].noteId,generated.id);assert.equal(stale[0].groundingEligible,false);assert.equal(core.validateGroundingRefs(notes,stale).ok,false);
 assert.equal(core.searchStoredNotes([core.withdrawNote(calculation,1)],'Calculation99').length,0);
 assert.equal(core.searchNotes(notes,'Calculation99').length,0); // A discovery index cannot pollute evidence caching.
});

test('stored file search includes other matching files when one long note has many higher-ranked passages',()=>{
 const long=core.createNote({title:'水の備蓄',body:Array.from({length:16},()=> '水 水 水 水 水').join('\n\n')});
 const other=core.createNote({title:'避難',body:'水を確認する。'});
 const before=structuredClone([long,other]);const hits=core.searchStoredNotes([long,other],'水',12);
 assert.ok(hits.some(hit=>hit.noteId===long.id));assert.ok(hits.some(hit=>hit.noteId===other.id),'another matching file must remain discoverable');
 const grounded=core.searchNotes([long,other],'水',12);assert.equal(grounded.length,12);assert.ok(grounded.every(hit=>hit.noteId===long.id),'grounded passage ranking is unchanged');
 assert.deepEqual([long,other],before);for(const hit of hits){const note=[long,other].find(n=>n.id===hit.noteId);assert.equal(note.revisions[0].body.slice(hit.start,hit.end),hit.quote);}
});
