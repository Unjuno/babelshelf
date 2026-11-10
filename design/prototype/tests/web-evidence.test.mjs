import test from 'node:test';
import assert from 'node:assert/strict';
import {createWebCitation,createWebSnapshot,validateWebCitation,bindWebCitationLabels} from '../src/web-evidence.ts';

const timestamp='2026-11-11T12:00:00.000Z';
const snapshot=()=>createWebSnapshot({id:'a14e399e-4248-4fba-a899-6311126bd211',sessionId:'f64a73f8-854e-468e-97bd-41107ad11f96',provider:'RustXNG',url:'https://docs.example.test/guide',title:'Guide',retrievedAt:timestamp,text:'Alpha source text. Beta source text.'});

test('Web citation binds an exact range to a host-owned snapshot',()=>{
 const page=snapshot(),citation=createWebCitation(page,{start:0,end:18});
 assert.equal(citation.quote,'Alpha source text.');
 assert.equal(validateWebCitation(citation,[page]),true);
 assert.equal(validateWebCitation(citation,[createWebSnapshot({...page,id:'83d05445-6d8f-4ca1-a3f9-a83c38d05f6d'})]),false);
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
