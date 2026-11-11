import test from 'node:test';
import assert from 'node:assert/strict';
import {createWebCitation,createWebSnapshot,validateWebCitation,bindWebCitationLabels,bindMixedEvidenceLabels,formatWebCitationAppendix} from '../src/web-evidence.ts';
import {bindMixedSourceLabelAnswer} from '../src/agent-evidence.ts';
import {groundedAnswer} from '../src/grounded-answer.ts';

const timestamp='2026-11-11T12:00:00.000Z';
const snapshot=()=>createWebSnapshot({id:'a14e399e-4248-4fba-a899-6311126bd211',sessionId:'f64a73f8-854e-468e-97bd-41107ad11f96',provider:'RustXNG',url:'https://docs.example.test/guide',title:'Guide',retrievedAt:timestamp,text:'Alpha source text. Beta source text.'});

test('Web citation binds an exact range to a host-owned snapshot',()=>{
 const page=snapshot(),citation=createWebCitation(page,{start:0,end:18});
 assert.equal(citation.quote,'Alpha source text.');
 assert.equal(validateWebCitation(citation,[page]),true);
 assert.equal(validateWebCitation(citation,[createWebSnapshot({...page,id:'83d05445-6d8f-4ca1-a3f9-a83c38d05f6d'})]),false);
});

test('reviewed note appendix preserves the citation excerpt and keeps page text inert',()=>{
 const page=createWebSnapshot({id:'a14e399e-4248-4fba-a899-6311126bd211',sessionId:'f64a73f8-854e-468e-97bd-41107ad11f96',provider:'RustXNG',url:'https://docs.example.test/guide',title:'Guide [read me]',retrievedAt:timestamp,text:'Quoted text with ```code``` and <script>.'});
 const citation=createWebCitation(page,{start:0,end:page.text.length}),appendix=formatWebCitationAppendix([citation],[page]);
 assert.match(appendix,/## Web sources/);assert.match(appendix,/URL: <https:\/\/docs\.example\.test\/guide>/);assert.match(appendix,/Retrieved: 2026-11-11T12:00:00\.000Z/);assert.match(appendix,/````text/);assert.match(appendix,/Quoted text with ```code``` and <script>\./);assert.ok(appendix.includes(String.raw`Guide \[read me\]`));
 assert.equal(formatWebCitationAppendix([],[]),'');
 assert.throws(()=>formatWebCitationAppendix([citation],[]),/Invalid Web citations/);
 assert.throws(()=>formatWebCitationAppendix(Array.from({length:65},()=>citation),[page]),/Invalid Web citations/);
});

test('Web snapshots reject unsafe identities, URLs, timestamps and oversized page text',()=>{
 const base={id:'a14e399e-4248-4fba-a899-6311126bd211',sessionId:'f64a73f8-854e-468e-97bd-41107ad11f96',provider:'RustXNG',url:'https://docs.example.test/guide',title:'Guide',retrievedAt:timestamp,text:'body'};
 for(const patch of [{url:'javascript:alert(1)'},{url:'https://user:pass@docs.example.test/'},{retrievedAt:'yesterday'},{sessionId:'other'},{text:'x'.repeat(12_001)}])assert.throws(()=>createWebSnapshot({...base,...patch}),/Web source snapshot/);
});

test('Web citations reject changed quotes, URL, timestamp and cross-session labels',()=>{
 const page=snapshot(),citation=createWebCitation(page,{start:19,end:35});
 assert.equal(citation.quote,'Beta source text');
 assert.equal(validateWebCitation({...citation,quote:'Forged source text'},[page]),false);
 assert.equal(validateWebCitation({...citation,url:'https://other.example/'},[page]),false);
 assert.equal(validateWebCitation({...citation,retrievedAt:'2026-11-11T12:01:00.000Z'},[page]),false);
 assert.throws(()=>bindWebCitationLabels(['S1'],[{label:'S1',citation}],[]),/Web source labels/);
 assert.throws(()=>bindWebCitationLabels(['S2'],[{label:'S1',citation}],[page]),/Web source labels/);
 assert.deepEqual(bindWebCitationLabels(['S1'],[{label:'S1',citation}],[page]),[citation]);
});

test('mixed source labels bind separately to verified Memory refs and live Web citations',()=>{
 const page=snapshot(),citation=createWebCitation(page,{start:0,end:18}),memory={noteId:'memory-record',revision:3,start:7,end:18,quote:'source text',title:'Local note'};
 assert.deepEqual(bindMixedEvidenceLabels(['S2','S1'],[{label:'S1',source:memory}],[{label:'S2',citation}],[page]),[
  {kind:'web',source:citation},{kind:'memory',source:memory},
 ]);
 assert.throws(()=>bindMixedEvidenceLabels(['S1'],[{label:'S1',source:memory}],[{label:'S1',citation}],[page]),/Invalid answer evidence labels/);
 assert.throws(()=>bindMixedEvidenceLabels(['S2'],[{label:'S1',source:memory}],[{label:'S2',citation}],[createWebSnapshot({...page,sessionId:'83d05445-6d8f-4ca1-a3f9-a83c38d05f6d'})]),/Invalid answer evidence labels/);
 assert.throws(()=>bindMixedEvidenceLabels(['S1'],[{label:'S1',source:{...memory,quote:'forged'}}],[],[]),/Invalid answer evidence labels/);
 assert.throws(()=>bindMixedEvidenceLabels(['S3'],[{label:'S1',source:memory}],[{label:'S2',citation}],[page]),/Invalid answer evidence labels/);
});

test('terminal answer returns exact host-bound Web citations and strips internal labels from Memory refs',()=>{
 const page=snapshot(),citation=createWebCitation(page,{start:0,end:18}),memory={noteId:'memory-record',revision:3,start:7,end:18,quote:'source text',title:'Local note'};
 const answer=bindMixedSourceLabelAnswer({answer:'The source confirms it.',sources:['S2','S1']},[{...memory,label:'S1'}],[{label:'S2',citation}],[page]);
 assert.deepEqual(answer.sources,[memory]);assert.deepEqual(answer.webSources,[citation]);
 assert.throws(()=>bindMixedSourceLabelAnswer({answer:'The source confirms it.',sources:['S2']},[],[{label:'S2',citation}],[]),/Invalid Web source labels/);
});

test('grounded answer revalidates session citations without persisting Web snapshots as Memory refs',async()=>{
 const page=snapshot(),citation=createWebCitation(page,{start:0,end:18}),engine={loaded:'test',assets:{test:{filesPresent:true}},manifest:{contextTokens:4096,models:[{id:'test',revision:'r1'}],runtime:{revision:'runtime-r1'}}};
 const answer=await groundedAnswer({store:{all:async()=>[],search:async()=>[]},engine},{model:'test',question:'What did the source page report?',mode:'answer',scope:{kind:'knowledge'},toolEvidence:{used:true,refs:[],webSnapshots:[page]},reply:{answer:'The source page contains supporting text.',sources:[],webSources:[citation]}});
 assert.deepEqual(answer.sources,[]);assert.deepEqual(answer.webSources,[citation]);
 await assert.rejects(groundedAnswer({store:{all:async()=>[],search:async()=>[]},engine},{model:'test',question:'What did the source page report?',mode:'answer',scope:{kind:'knowledge'},toolEvidence:{used:true,refs:[],webSnapshots:[]},reply:{answer:'The source page contains supporting text.',sources:[],webSources:[citation]}}),/Invalid answer or sources|No matching notes/);
});
