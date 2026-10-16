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
