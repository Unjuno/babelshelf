import test from 'node:test';
import assert from 'node:assert/strict';
import {makeStateBackup,parseStateBackup,stateHash} from '../src/backup-state.ts';
import {createNote,latest,reviseNote} from '../../../dist/core.js';
import {createCustomToolPackageFiles} from '../src/custom-tool-package.ts';
import {applyCorrection,prepareCorrection,proposeCorrection,undoCorrection} from '../src/note-corrections.ts';

const records=()=>createCustomToolPackageFiles({id:'user.date-format',title:'Date format',instructions:'Format a date.',code:'({ input }) => ({ value: input.query })',capabilities:[]}).map(file=>({...createNote(file),id:file.path.endsWith('/SKILL.md')?'skill':'entry'}));

test('source proposal rejects invalid or exhausted counts and caps a large model output allowance',async()=>{
 const all=records(),target=all.find(note=>note.id==='entry');let calls=0;
 const engine={manifest:{contextTokens:8192},count:async()=>({prompt_tokens:100}),generate:async(messages,maxTokens)=>{calls++;assert.ok(maxTokens<=4096);return {text:JSON.stringify({body:'({ input }) => ({ value: input.query.trim() })'})};}};
 for(const tokens of [NaN,Infinity,-1,0.5,8000])await assert.rejects(proposeCorrection({...engine,count:async()=>({prompt_tokens:tokens})},'Trim',target,()=>{},all),/token budget|context limit/);
 assert.equal(calls,0);await proposeCorrection(engine,'Trim',target,()=>{},all);assert.equal(calls,1);
 let stopped=false;
 await assert.rejects(proposeCorrection({...engine,count:async()=>{stopped=true;return {prompt_tokens:100};}},'Trim',target,()=>{if(stopped)throw Error('Stopped');},all),/Stopped/);
 assert.equal(calls,1,'Stop during token counting must not start generation');
});

test('source approval pins its paired file even when a concurrent change remains a valid package',()=>{
 for(const targetId of ['entry','skill']){
  const all=records(),target=all.find(note=>note.id===targetId),pair=all.find(note=>note.id!==targetId);
  const after=targetId==='entry'?'({ input }) => ({ value: input.query.trim() })':latest(target).body.replace('Format a date.','Format a date supplied by the user.');
  const proposal=prepareCorrection(target,'Update this file',JSON.stringify({body:after}),all);
  const newBody=targetId==='entry'?latest(pair).body.replace('Format a date.','Parse a timestamp instead.'):'({ input }) => ({ value: "new behavior" })';
  const concurrent=all.map(note=>note.id===pair.id?reviseNote(note,{body:newBody},1):note);
  assert.throws(()=>applyCorrection(concurrent,proposal),/Version conflict/,'A valid paired edit must invalidate the review');
  assert.throws(()=>applyCorrection(all,{...proposal,dependencies:undefined}),/Version conflict/,'Cannot discard the reviewed dependency');
  assert.equal(latest(target).version,1);
 }
});

test('tool correction receives the paired contract and retains that pre-inference snapshot',async()=>{
 const all=records(),target=all.find(note=>note.id==='entry'),originalSkill=structuredClone(all.find(note=>note.id==='skill'));
 all.push(createNote({path:'Home/private.md',body:'UNRELATED_PRIVATE_SENTINEL'}));
 let sent;
 const engine={manifest:{contextTokens:4096},count:async()=>{
  all[0]=reviseNote(all[0],{body:latest(all[0]).body.replace('Format a date.','Different instructions.')},1);
  return {prompt_tokens:300};
 },generate:async messages=>{sent=messages;return {text:JSON.stringify({body:'({ input }) => ({ value: input.query.trim() })'})};}};
 const proposal=await proposeCorrection(engine,'Trim whitespace',target,()=>{},all);
 const context=JSON.parse(sent[1].content);
 assert.deepEqual(context.pairedSource,{path:'Tools/user.date-format/SKILL.md',body:latest(originalSkill).body});
 assert.equal(JSON.stringify(sent).includes('UNRELATED_PRIVATE_SENTINEL'),false);
 assert.deepEqual(proposal.dependencies,[originalSkill]);
 assert.throws(()=>applyCorrection(all,proposal),/Version conflict/);
});

test('chat proposes a custom tool source change as inert data for explicit diff review, then saves it with history and Undo',async()=>{
 const all=records(),target=all.find(note=>latest(note).path.endsWith('/tool.js')),changed='({ input }) => ({ value: String(input.query).trim() })',engine={manifest:{contextTokens:2048},count:async()=>({prompt_tokens:100}),generate:async()=>({text:JSON.stringify({body:changed})})};
 const proposal=await proposeCorrection(engine,'Trim extra whitespace before formatting',target,()=>{},all);
 assert.equal(proposal.path,'Tools/user.date-format/tool.js');assert.equal(proposal.before,latest(target).body);assert.equal(proposal.after,changed);assert.equal(proposal.operation.name,'text.rewrite');
 assert.equal(latest(target).body,proposal.before,'proposal generation is read-only');
 const applied=applyCorrection(all,proposal),saved=all.map(note=>note.id===target.id?applied.note:note);
 assert.equal(latest(applied.note).body,changed);assert.equal(latest(applied.note).version,2);assert.equal(saved.find(note=>note.id==='skill')?.revisions.length,1);
 const undone=undoCorrection(saved,applied.receipt);assert.equal(latest(undone.note).body,proposal.before);assert.equal(latest(undone.note).version,3);
});

test('custom tool proposals reject code that makes the paired package invalid before review and again at commit',async()=>{
 const all=records(),target=all.find(note=>latest(note).path.endsWith('/tool.js')),engine={manifest:{contextTokens:2048},count:async()=>({prompt_tokens:100}),generate:async()=>({text:JSON.stringify({body:'  '})})};
 await assert.rejects(proposeCorrection(engine,'Break the tool',target,()=>{},all),/Invalid|empty|too large/i);
 const validProposal=prepareCorrection(target,'Change source',JSON.stringify({action:'rewrite',body:'({ input }) => ({ value: String(input.query) })'}),all);
 const brokenSkill=all.map(note=>note.id==='skill'?{...note,revisions:[{...note.revisions.at(-1),body:'not valid metadata'}]}:note);
 assert.throws(()=>applyCorrection(brokenSkill,validProposal),/metadata|package|SKILL/i);
});

test('chat cannot alter custom tool identity, version or declared capability through SKILL.md correction',async()=>{
 const all=records(),target=all.find(note=>latest(note).path.endsWith('/SKILL.md')),before=latest(target).body,header=before.match(/^---\n([\s\S]*?)\n---/)[1],metadata=JSON.parse(header);
 for(const changed of [
  before.replace(header,JSON.stringify({...metadata,id:'user.other-tool'})),
  before.replace(header,JSON.stringify({...metadata,version:2})),
  before.replace(header,JSON.stringify({...metadata,capabilities:['memory.read']})),
 ]){
  const engine={manifest:{contextTokens:2048},count:async()=>({prompt_tokens:100}),generate:async()=>({text:JSON.stringify({body:changed})})};
  await assert.rejects(proposeCorrection(engine,'Expand this tool',target,()=>{},all),/identity|capabilities|fixed/i);
 }
 assert.equal(latest(target).body,before);
});

test('chat can propose an additive input-schema extension with review, paired-source CAS and Undo',async()=>{
 const all=records(),target=all.find(note=>latest(note).path.endsWith('/SKILL.md')),paired=all.find(note=>note.id!==target.id),before=latest(target).body,header=before.match(/^---\n([\s\S]*?)\n---/)[1],metadata=JSON.parse(header);
 metadata.inputSchema.properties.precision={type:'integer',minimum:0,maximum:6,description:'Decimal places'};
 const after=before.replace(header,JSON.stringify(metadata)),engine={manifest:{contextTokens:2048},count:async()=>({prompt_tokens:100}),generate:async()=>({text:JSON.stringify({body:after})})};
 const proposal=await proposeCorrection(engine,'Add an optional precision input from zero to six decimal places',target,()=>{},all);
 assert.equal(proposal.after,after);assert.deepEqual(proposal.dependencies,[paired]);assert.equal(latest(target).body,before,'proposal generation is read-only');
 const concurrent=all.map(note=>note.id===paired.id?reviseNote(note,{body:latest(note).body+'\n// concurrent edit\n'},1):note);
 assert.throws(()=>applyCorrection(concurrent,proposal),/Version conflict/);
 const committed=applyCorrection(all,proposal),saved=all.map(note=>note.id===target.id?committed.note:note);
 const currentMetadata=JSON.parse(latest(committed.note).body.match(/^---\n([\s\S]*?)\n---/)[1]);
 assert.equal(currentMetadata.inputSchema.properties.precision.maximum,6);assert.equal(latest(committed.note).version,2);
 const undone=undoCorrection(saved,committed.receipt);assert.equal(latest(undone.note).body,before);assert.equal(latest(undone.note).version,3);
});

test('chat schema proposals still reject malformed or unsupported input fields',async()=>{
 const all=records(),target=all.find(note=>latest(note).path.endsWith('/SKILL.md')),before=latest(target).body,header=before.match(/^---\n([\s\S]*?)\n---/)[1],metadata=JSON.parse(header);
 metadata.inputSchema.properties.query.pattern='.*';const invalid=before.replace(header,JSON.stringify(metadata)),engine={manifest:{contextTokens:2048},count:async()=>({prompt_tokens:100}),generate:async()=>({text:JSON.stringify({body:invalid})})};
 await assert.rejects(proposeCorrection(engine,'Add validation',target,()=>{},all),/schema|field|Invalid/i);assert.equal(latest(target).body,before);
});

test('past tool-source receipts back up without a live package and still reject a forged operation hash',async()=>{
 const all=records(),target=all.find(note=>latest(note).path.endsWith('/tool.js'));
 const proposal=prepareCorrection(target,'Trim input',JSON.stringify({action:'rewrite',body:'({ input }) => ({ value: input.query.trim() })'}),all);
 const applied=applyCorrection(all,proposal),backup=await makeStateBackup({notes:[applied.note],settings:[],runs:[{key:'ui-v1-correction-'+applied.receipt.id,value:applied.receipt}]});
 assert.equal((await parseStateBackup(JSON.stringify(backup))).runs[0].value.id,applied.receipt.id);
 const forged=structuredClone(backup);
 forged.payload.runs[0].value.operation.arguments.bodySha256='0'.repeat(64);
 forged.sha256=stateHash(forged.payload);
 await assert.rejects(parseStateBackup(JSON.stringify(forged)),/hash|operation/i);
});
