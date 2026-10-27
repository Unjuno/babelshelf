import test from 'node:test';
import assert from 'node:assert/strict';
import {createInputSubmission} from '../src/input-submission.ts';
import {emptyDialogue,validateDialogue} from '../src/conversation.ts';
import {prepareOriginal,originalRef} from '../src/original-assets.ts';

const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
async function attachment(name='source.md',type='text/markdown'){
 const file=new File(['Original marker PALM-731'],name,{type});
 return {id:'original-1',name,kind:type.startsWith('image/')?'image':'text',size:file.size,status:'Ready',file,url:'blob:preview'};
}
function ports(overrides={}){
 const prior=emptyDialogue();
 return {snapshot:async()=>({prior,expected:undefined}),original:async()=>{throw Error('unexpected original read');},read:async()=>{throw Error('unexpected extraction');},commit:async value=>{validateDialogue(value.next);return value.originals;},...overrides};
}

test('submission owns a copied input and commits original plus dialogue before exposing recovery',async()=>{
 const input=await attachment(),operation=createInputSubmission('turn-1','Find marker',[input],()=>{});
 assert.equal(operation.committed,null);
 const result=await operation.run(ports({commit:async value=>{
  assert.equal(operation.committed,null);assert.equal(value.originals.length,1);assert.equal(value.next.turns[0].attachments[0].asset.sha256,value.originals[0].sha256);
  validateDialogue(value.next);return value.originals;
 }}));
 assert.equal(input.status,'Ready');assert.ok(input.file);assert.equal(result.sent[0].file,undefined);
 assert.equal(result.sent[0].status,'Text available');assert.equal(result.sent[0].url,'blob:preview');
 assert.equal(operation.recover({text:'',attachments:[]}).text,'Find marker');
 assert.equal(operation.recover({text:'New draft',attachments:[]}),null);
 assert.equal(operation.recover({text:'',attachments:[{id:'new'}]}),null);
 await assert.rejects(operation.run(ports()),/already submitted/);
});

test('failed commit leaves the original draft intact and exposes no committed receipt',async()=>{
 const input=await attachment(),operation=createInputSubmission('turn-2','Original request',[input],()=>{});
 await assert.rejects(operation.run(ports({commit:async()=>{throw Error('Version conflict');}})),/Version conflict/);
 assert.equal(operation.committed,null);assert.equal(operation.recover({text:'',attachments:[]}),null);assert.ok(input.file);assert.equal(input.status,'Ready');
});

test('Stop during extraction prevents any submission and leaves attachments untouched',async()=>{
 const gate=deferred(),entered=deferred(),input=await attachment('scan.png','image/png');let stopped=false,commits=0;
 const operation=createInputSubmission('turn-3','Read image',[input],()=>{if(stopped)throw Error('Stopped');});
 const pending=operation.run(ports({read:async()=>{entered.resolve();await gate.promise;return {status:'Not prepared'};},commit:async()=>{commits++;}}));
 await entered.promise;stopped=true;gate.resolve();await assert.rejects(pending,/Stopped/);
 assert.equal(commits,0);assert.equal(operation.committed,null);assert.equal(input.status,'Ready');
});

test('Stop during an atomic commit retains the acknowledged receipt without replay',async()=>{
 const gate=deferred(),entered=deferred();let stopped=false,commits=0;
 const check=()=>{if(stopped)throw Error('Stopped');};
 const operation=createInputSubmission('turn-4','Question',[],check);
 const pending=operation.run(ports({commit:async()=>{commits++;entered.resolve();await gate.promise;return 'saved';}}));
 await entered.promise;stopped=true;gate.resolve();const result=await pending;
 assert.equal(result.saved,'saved');assert.equal(result.next.turns[0].id,'turn-4');assert.equal(commits,1);
 assert.throws(check,/Stopped/);assert.equal(operation.recover({text:'',attachments:[]}).text,'Question');
 await assert.rejects(operation.run(ports()),/already submitted/);assert.equal(commits,1);
});

test('retry stages committed references and does not rewrite original bytes',async()=>{
 const first=createInputSubmission('turn-5','Read',[await attachment()],()=>{});
 const result=await first.run(ports());
 const recovery=first.recover({text:'',attachments:[]});
 const retry=createInputSubmission('turn-6',recovery.text,recovery.attachments,()=>{});
 await retry.run(ports({original:async ref=>{assert.deepEqual(ref,originalRef(result.saved[0]));return result.saved[0];},commit:async value=>{assert.equal(value.originals.length,0);assert.deepEqual(value.next.turns[0].attachments[0].asset,originalRef(result.saved[0]));}}));
});

test('retrieved originals must match the committed reference before entering a new turn',async()=>{
 const file=await attachment(),asset=await prepareOriginal(file.file,file.id);
 const operation=createInputSubmission('turn-7','Read',[{...file,file:undefined,asset:{...originalRef(asset),sha256:'0'.repeat(64)}}],()=>{});
 let commits=0;await assert.rejects(operation.run(ports({original:async()=>asset,commit:async()=>{commits++;}})),/Original/);
 assert.equal(commits,0);
});

test('operation identity checked after snapshot prevents stale submission',async()=>{
 let current='turn-8',commits=0;const operation=createInputSubmission('turn-8','Question',[],()=>{if(current!=='turn-8')throw Error('Stopped');});
 await assert.rejects(operation.run(ports({snapshot:async()=>{current='turn-9';return {prior:emptyDialogue(),expected:undefined};},commit:async()=>{commits++;}})),/Stopped/);
 assert.equal(commits,0);assert.equal(operation.committed,null);
});

test('retry after a processed PDF was committed reuses the original and extraction',async()=>{
 const file=new File(['synthetic PDF bytes'],'retry.pdf',{type:'application/pdf'});
 const item={id:'pdf-original-1',name:'retry.pdf',kind:'file',size:file.size,status:'Ready',file};
 const reading={kind:'pdf',id:'pdf-reading-1',value:{pages:[{page:1}],totalPages:1}};
 const first=createInputSubmission('pdf-turn-1','What is in this PDF?',[item],()=>{});
 const result=await first.run(ports({read:async()=>({status:'Read',reading}),commit:async value=>{assert.equal(value.originals.length,1);assert.equal(value.readings.length,1);return value.originals;}}));
 const retry=createInputSubmission('pdf-turn-2','What is in this PDF?',first.recover({text:'',attachments:[]}).attachments,()=>{});
 await retry.run(ports({original:async()=>result.saved[0],read:async()=>{throw Error('extraction repeated');},commit:async value=>{assert.equal(value.originals.length,0);assert.equal(value.readings.length,0);assert.equal(value.next.turns[0].attachments[0].reading.noteId,'pdf-reading-1');}}));
});
