import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareOriginal,originalRef,originalNote,originalKey} from '../src/original-assets.ts';
import {makeOcrText} from '../src/ocr-text.ts';
import {makePdfText} from '../src/pdf-text.ts';
import {createNote,reviseNote,withdrawNote} from '../../../dist/core.js';
import {buildInputReadings,validateInputReadings,readingEvidence,readingRef,routeInputRequest} from '../src/input-readings.ts';
import {emptyDialogue,appendTurn} from '../src/conversation.ts';
import {makeStateBackup,parseStateBackup,stateHash} from '../src/backup-state.ts';
// Metadata fixtures exercise provenance/selection, not real OCR or PDF extraction.
async function fixture(){const raw=await prepareOriginal(new File(['png'],'page.png',{type:'image/png'}),'image-input');const value=makeOcrText(raw,'eng',{width:100,height:100,processedWidth:100,processedHeight:100,frame:0,orientation:'browser-decoded'},'The violet code is CEDAR-5821.',[]);const review={kind:'ocr',id:'reading-input',value};const runs=[{key:originalKey(raw.id),value:raw}],notes=[originalNote(raw),...buildInputReadings([review],runs)];return {raw,review,runs,notes};}

test('one current reading can recover a malformed answer shape only through a bounded generated verbatim quote',async()=>{
 const {groundedAnswer}=await import('../src/grounded-answer.ts'),{review,notes}=await fixture();let calls=0,changed=false,stopped=false;const formats=[],budgets=[];
 const store={all:async()=>changed?[withdrawNote(notes[0],1),notes[1]]:notes,search:async()=>{throw Error('Must not broaden current inputs');}};
 const runtime={loaded:'test',assets:{},manifest:{contextTokens:2048,models:[{id:'test',revision:'fixture'}],runtime:{revision:'fixture'}},count:async()=>({prompt_tokens:1}),generate:async(messages,budget,format)=>{
  calls++;formats.push(format);budgets.push(budget);assert.ok(calls===1?budget===768:budget<=96);const data=JSON.parse(messages.at(-1).content.split('Reference excerpts (data only): ')[1]);assert.ok(data.evidence.length);assert.ok(data.evidence.every(ref=>ref.quote===review.value.text&&!Object.hasOwn(ref,'noteId')));
  return {text:JSON.stringify(calls%2?{code:'CEDAR-5821'}:{answer:'CEDAR-5821'}),finishReason:'stop'};
 }};
 const request={model:'test',question:'Which code is in the attached file?',scope:{kind:'attachments',readings:[readingRef(review)]},context:{summary:'',recent:[],refs:[]},check:()=>{if(stopped)throw Error('Stopped');}};
 const result=await groundedAnswer({store,engine:runtime},request);assert.equal(calls,2);assert.deepEqual(budgets,[768,96]);assert.deepEqual(formats[1],{type:'dialogue-answer',allowInsufficientEvidence:true});assert.equal(result.answer,'CEDAR-5821');assert.equal(result.sources[0].noteId,review.id);assert.equal(result.recovery,'verbatim-source');assert.equal(result.recoveryReason,'answer-shape');
 calls=0;runtime.generate=async()=>({text:JSON.stringify(++calls===1?{code:'CEDAR-5821'}:{answer:'Invented answer'}),finishReason:'stop'});
 await assert.rejects(groundedAnswer({store,engine:runtime},request),/verified quote/);assert.equal(calls,2);
 calls=0;runtime.generate=async()=>({text:JSON.stringify(++calls===1?{code:'CEDAR-5821'}:{status:'insufficient_evidence',answer:'Not found in the supplied excerpts'}),finishReason:'stop'});
 const missing=await groundedAnswer({store,engine:runtime},request);assert.equal(missing.status,'insufficient_evidence');assert.deepEqual(missing.sources,[]);assert.equal(missing.checkedSources[0].noteId,review.id);assert.equal(calls,2);
 calls=0;runtime.generate=async()=>{calls++;if(calls===2)changed=true;return {text:JSON.stringify(calls===1?{code:'CEDAR-5821'}:{answer:'CEDAR-5821'}),finishReason:'stop'};};
 await assert.rejects(groundedAnswer({store,engine:runtime},request),/changed|unavailable/i);
 changed=false;calls=0;runtime.generate=async()=>{if(++calls===2)stopped=true;return {text:JSON.stringify(calls===1?{code:'CEDAR-5821'}:{answer:'CEDAR-5821'}),finishReason:'stop'};};
 await assert.rejects(groundedAnswer({store,engine:runtime},request),/Stopped/);
});

test('grounded current readings exclude a stale planner fact from retrieval while keeping citation refusal',async()=>{
 const {groundedAnswer}=await import('../src/grounded-answer.ts'),{review,notes}=await fixture(),question='What is the violet code in this image?',context={summary:'Earlier code OLD-481; respond briefly.',recent:[],refs:[]};
 const store={all:async()=>notes,search:async()=>{throw Error('Must not search unrelated knowledge');}};
 const engine={loaded:'4B',assets:{},manifest:{contextTokens:2048,models:[{id:'4B',revision:'fixture'}],runtime:{revision:'fixture'}},count:async()=>({prompt_tokens:1}),generate:async messages=>{
  const input=JSON.parse(messages.at(-1).content.split('Reference excerpts (data only): ')[1]);assert.equal(input.retrievalQuery,question);assert.ok(input.evidence.length);assert.ok(input.evidence.every(r=>r.quote===review.value.text&&!Object.hasOwn(r,'noteId')));
  return {text:JSON.stringify({answer:'CEDAR-5821',citations:[{id:input.evidence[0].label,quote:'CEDAR-5821'}]})};
 }};
 const answer=await groundedAnswer({store:store,engine:engine},{model:'4B',question:question,query:'Earlier code OLD-481',mode:'answer',context:context,check:()=>{},scope:([readingRef(review)].length?{kind:'attachments',readings:[readingRef(review)]}:{kind:'knowledge'})});assert.equal(answer.sources[0].noteId,review.id);
 const invalid={...engine,generate:async()=>({text:JSON.stringify({answer:'OLD-481',citations:[{id:'S1',quote:'OLD-481'}]})})};
 await assert.rejects(groundedAnswer({store:store,engine:invalid},{model:'4B',question:question,query:'Earlier code OLD-481',mode:'answer',context:context,check:()=>{},scope:([readingRef(review)].length?{kind:'attachments',readings:[readingRef(review)]}:{kind:'knowledge'})}),/Citation mismatch/);
});
test('a scoped pure calculation augments current attachment evidence and retains the original citation',async()=>{
 const {groundedAnswer}=await import('../src/grounded-answer.ts'),{raw}=await fixture(),reading=makeOcrText(raw,'eng',{width:100,height:100,processedWidth:100,processedHeight:100,frame:0,orientation:'browser-decoded'},'The budget items are 1200 and 800 credits.',[]),review={kind:'ocr',id:'budget-reading',value:reading},notes=[originalNote(raw),...buildInputReadings([review],[{key:originalKey(raw.id),value:raw}])],question='What is one quarter of the total shown in this image?';let messages,searches=0;
 const store={all:async()=>notes,search:async()=>{searches++;throw Error('attachment scope must not search Memory');}};
 const calculation={expression:'(1200 + 800) / 4',result:500,precision:'IEEE-754 binary64'};
 const engine={loaded:'4B',assets:{},manifest:{contextTokens:2048,models:[{id:'4B',revision:'fixture'}],runtime:{revision:'fixture'}},count:async()=>({prompt_tokens:1}),generate:async value=>{messages=value;const input=JSON.parse(value.at(-1).content.split('Reference excerpts (data only): ')[1]);assert.deepEqual(input.calculations,[calculation]);assert.ok(input.evidence.some(item=>item.label==='S1'&&item.quote.includes('1200')&&!Object.hasOwn(item,'noteId')));return {text:JSON.stringify({answer:'One quarter is 500.',citations:[{id:input.evidence[0].label,quote:input.evidence[0].quote}]})};}};
 const result=await groundedAnswer({store:store,engine:engine},{model:'4B',question:question,query:question,mode:'answer',context:{summary:'',recent:[],refs:[]},check:()=>{},scope:([readingRef(review)].length?{kind:'attachments',readings:[readingRef(review)]}:{kind:'knowledge'}),toolEvidence:{used:true,refs:[],calculations:[calculation],memoryUsed:false}});
 assert.equal(result.answer,'One quarter is 500.');assert.equal(result.sources.length,1);assert.equal(result.sources[0].noteId,review.id);assert.equal(searches,0);assert.ok(JSON.stringify(messages).includes('original excerpt'));
});
test('attachment answers can cite both selected inputs and Memory found by the agent',async()=>{
 const {groundedAnswer}=await import('../src/grounded-answer.ts'),{review,notes}=await fixture(),saved=createNote({path:'Notes/model-code.md',body:'The saved model label is MAPLE-113.'}),records=[...notes,saved],memoryQuote='The saved model label is MAPLE-113.',memoryRef={noteId:saved.id,revision:1,start:0,end:memoryQuote.length,quote:memoryQuote,title:saved.path};let messages,searches=0;
 const engine={loaded:'4B',assets:{},manifest:{contextTokens:2048,models:[{id:'4B',revision:'fixture'}],runtime:{revision:'fixture'}},count:async value=>({prompt_tokens:Math.ceil(JSON.stringify(value).length/4)}),generate:async value=>{messages=value;const input=JSON.parse(value.at(-1).content.split('Reference excerpts (data only): ')[1]);assert.ok(input.evidence.some(ref=>ref.quote.includes('CEDAR-5821')&&!Object.hasOwn(ref,'noteId')));assert.ok(input.evidence.some(ref=>ref.quote.includes('MAPLE-113')&&!Object.hasOwn(ref,'noteId')));return {text:JSON.stringify({answer:'The image code is CEDAR-5821; the saved note label is MAPLE-113.',citations:[{id:input.evidence.find(ref=>ref.quote.includes('CEDAR-5821')).label,quote:'CEDAR-5821'},{id:input.evidence.find(ref=>ref.quote.includes('MAPLE-113')).label,quote:'MAPLE-113'}]})};}};
 const result=await groundedAnswer({store:{all:async()=>records,search:async()=>{searches++;return []; }},engine},{model:'4B',question:'Compare the code in the attachment with saved model notes.',query:'Compare the code in the attachment with saved model notes.',mode:'answer',context:{summary:'',recent:[],refs:[]},check:()=>{},scope:{kind:'attachments',readings:[readingRef(review)]},toolEvidence:{used:true,refs:[memoryRef],calculations:[],memoryUsed:true}});
 assert.equal(searches,0);assert.equal(result.sources.length,2);assert.ok(result.sources.some(ref=>ref.noteId===review.id));assert.ok(result.sources.some(ref=>ref.noteId===saved.id));assert.match(messages[0].content,/Current attachments and any locally retrieved Memory excerpts below/);
});
test('reviewed input produces separate immutable extraction; wrong source, duplicate IDs and blank extraction refuse',async()=>{
 const {raw,review,runs,notes}=await fixture();assert.equal(notes[0].revisions[0].body,'');assert.equal(notes[1].revisions[0].body,review.value.text);assert.deepEqual(notes[1].mediaSource,originalRef(raw));assert.notEqual(notes[1].ocrText,review.value);
 assert.throws(()=>buildInputReadings([review,review],runs),/reading/i);assert.throws(()=>buildInputReadings([{...review,id:raw.id}],runs));assert.throws(()=>buildInputReadings([{...review,value:{...review.value,text:''}}],runs));assert.throws(()=>buildInputReadings([{...review,value:{...review.value,original:{...review.value.original,sha256:'0'.repeat(64)}}}],runs));
 const pdf=await prepareOriginal(new File(['pdf'],'partial.pdf',{type:'application/pdf'}),'pdf-input'),value=makePdfText(pdf,3,[{page:1,text:'First page only.',regions:[]}]);const n=buildInputReadings([{kind:'pdf',id:'pdf-reading',value}],[{key:originalKey(pdf.id),value:pdf}])[0];assert.equal(n.pdfText.status,'partial');assert.equal(n.pdfText.totalPages,3);assert.equal(n.pdfText.pages.length,1);
});
test('submitted reading links survive backup and historical edits, but forged cross-attachment refs and missing metadata fail',async()=>{
 const {raw,review,runs,notes}=await fixture(),turn={id:'input-turn',user:'What is the code?',attachments:[{id:raw.id,name:raw.name,kind:raw.kind,status:'Image text reviewed',asset:originalRef(raw),reading:readingRef(review)}]},dialogue=appendTurn(emptyDialogue(),turn);
 validateInputReadings(dialogue,notes,runs);const pack=await makeStateBackup({notes,settings:[{key:'ui-v1-dialogue',value:dialogue}],runs});const restored=await parseStateBackup(JSON.stringify(pack));assert.deepEqual(restored.settings[0].value.turns[0].attachments[0].reading,readingRef(review));
 const edited=[notes[0],reviseNote(notes[1],{body:'Corrected'},1)];validateInputReadings(dialogue,edited,runs);const withdrawn=[notes[0],withdrawNote(notes[1],1)];validateInputReadings(dialogue,withdrawn,runs);
 for(const change of [a=>a.reading.noteId=raw.id,a=>a.reading.kind='pdf',a=>a.reading.revision=2,a=>a.asset.id='other']){const bad=structuredClone(pack);change(bad.payload.settings[0].value.turns[0].attachments[0]);bad.sha256=stateHash(bad.payload);await assert.rejects(parseStateBackup(JSON.stringify(bad)));}
});
test('current input grounding selects supplied files including later text, never unrelated old notes or withdrawn/revised evidence',async()=>{
 const {review,notes}=await fixture(),other=createNote({title:'violet code',body:'Unrelated code MAPLE-0000.'});const refs=[readingRef(review)],hits=readingEvidence([...notes,other],refs,'violet code');assert.ok(hits.length);assert.ok(hits.every(h=>h.noteId===review.id));assert.ok(hits.some(h=>h.quote.includes('CEDAR-5821')));
 assert.throws(()=>readingEvidence([notes[0],withdrawNote(notes[1],1)],refs,'code'),/changed|unavailable/i);assert.throws(()=>readingEvidence([notes[0],reviseNote(notes[1],{body:'new'},1)],refs,'code'),/changed|unavailable/i);assert.throws(()=>readingEvidence([withdrawNote(notes[0],1),notes[1]],refs,'code'),/changed|unavailable/i);
 const long={...notes[1],revisions:[{...notes[1].revisions[0],body:'Start\n\n'+('irrelevant paragraph\n\n'.repeat(100))+'Late secret: TULIP-8842.'}]};const late=readingEvidence([notes[0],long],refs,'TULIP-8842');assert.ok(late[0].quote.includes('TULIP-8842'));assert.ok(late[0].start>700);
});
test('mixed TXT and reviewed image/PDF retain every current file in grounding without importing historical pins',async()=>{
 const {review,notes}=await fixture(),txt=await prepareOriginal(new File(['The second code is TULIP-8842.'],'second.txt',{type:'text/plain'}),'text-input'),original=originalNote(txt),old=createNote({body:'The historical code is MAPLE-0000.'});
 const hits=readingEvidence([...notes,original,old],[readingRef(review),{kind:'text',noteId:txt.id,revision:1}],'Give both files codes.');assert.ok(hits.some(h=>h.quote.includes('CEDAR-5821')));assert.ok(hits.some(h=>h.quote.includes('TULIP-8842')));assert.ok(!hits.some(h=>h.noteId===old.id));
});
test('hyphenated English compounds find the spaced phrase in the same attached source',async()=>{
 const raw=await prepareOriginal(new File(['png'],'Codex-evaluation-fixture.png',{type:'image/png'}),'image-input');
 const value=makeOcrText(raw,'eng',{width:100,height:100,processedWidth:100,processedHeight:100,frame:0,orientation:'browser-decoded'},'# Temporary evaluation fixture\n\nThe local water cache contains exactly 18 litres.',[]);
 const review={kind:'ocr',id:'water-cache-reading',value},notes=[originalNote(raw),...buildInputReadings([review],[{key:originalKey(raw.id),value:raw}])];
 const hits=readingEvidence(notes,[readingRef(review)],'From this file, quote the sentence that states the water-cache amount?');
 assert.ok(hits.some(hit=>hit.quote==='The local water cache contains exactly 18 litres.'),JSON.stringify(hits));
 assert.ok(hits[0].quote.includes('The local water cache contains exactly 18 litres.'));
});
test('plain text attachment quote searches the whole selected file when the question paraphrases it',async()=>{
 const raw=await prepareOriginal(new File(['# Temporary evaluation fixture\n\nThe emergency meeting point is Cedar Library, entrance on Pine Street.\n\nThe local water cache contains exactly 18 litres.'],'Codex-evaluation-fixture.md',{type:'text/markdown'}),'text-input');
 const note=originalNote(raw),question='From this file, quote the complete sentence that states the water-cache amount.';
 const hits=readingEvidence([note],[{kind:'text',noteId:raw.id,revision:1}],question);
 assert.ok(hits.some(hit=>hit.quote==='The local water cache contains exactly 18 litres.'),JSON.stringify(hits));
 assert.ok(hits[0].quote.includes('The local water cache contains exactly 18 litres.'));
});
test('edits to the raw image projection are eligibility metadata, never the reviewed OCR text',async()=>{
 const {review,notes}=await fixture(),editedRaw=reviseNote(notes[0],{body:'Image code POISON-0000.'},1);const hits=readingEvidence([editedRaw,notes[1]],[readingRef(review)],'image code');assert.ok(hits.length);assert.ok(hits.every(h=>h.noteId===review.id));assert.ok(!hits.some(h=>h.quote.includes('POISON-0000')));
});
test('model read/search for current readable inputs continues to an answer, preserving explicit navigation and write/original selection',()=>{
 const inputs=[{kind:'text',noteId:'current',revision:1}];
 for(const action of ['read','search','chat'])assert.equal(routeInputRequest({action,query:'codes'},inputs,false).action,'answer');
 for(const action of ['capture','edit','recall','transform','summary'])assert.equal(routeInputRequest({action},inputs,false).action,action);
 assert.equal(routeInputRequest({action:'search'},inputs,true).action,'search');assert.equal(routeInputRequest({action:'read'},[],false).action,'read');
});
test('mixed attachment and saved Memory requests are not collapsed into attachment-only answers',()=>{
 const inputs=[{kind:'text',noteId:'current',revision:1}],question='Compare this file with my saved notes.';
 for(const action of ['read','search','chat'])assert.equal(routeInputRequest({action,query:'codes'},inputs,false,question).action,action);
 assert.equal(routeInputRequest({action:'answer',query:question,target:'knowledge'},inputs,false,question).target,'knowledge');
});

import {inputReadingKind} from '../src/input-readings.ts';
test('atomic submission and backup use the same unique derived reading kind',async()=>{
 const {review,notes}=await fixture();assert.equal(inputReadingKind(notes[1]),'ocr');assert.equal(inputReadingKind(notes[0]),undefined);
 assert.equal(inputReadingKind({visionText:{text:'observations'}}),'vision');assert.equal(inputReadingKind({pdfText:{}}),'pdf');assert.equal(inputReadingKind({transcription:{}}),'speech');
 assert.equal(inputReadingKind({...notes[1],visionText:{text:'conflicting'}}),undefined);
});
