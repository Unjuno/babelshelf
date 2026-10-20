import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {speechModels,getSpeechManifest,speechModelProvenance} from '../src/speech-models.ts';
import {speechFile,speechReady,prepareSpeech} from '../src/speech-assets.ts';
import {capabilityState} from '../src/local-capabilities.ts';
import {speechAssetInput} from '../src/asset-activity.ts';
import {makeTranscript,validateTranscript,transcriptNote} from '../src/speech-transcript.ts';
import {prepareOriginal,originalNote,originalKey} from '../src/original-assets.ts';

test('each built-in speech selection owns exact package pins, capacity and runtime provenance',async()=>{
 const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url)));
 assert.deepEqual(speechModels.map(m=>m.id),['whisper-tiny','whisper-base']);
 const base=getSpeechManifest('whisper-base');
 assert.equal(base.revision,'1846881b6b3a3024392c1eea3ad983695bc23925');
 assert.equal(base.files.reduce((n,f)=>n+f.bytes,0),79666385);
 for(const model of speechModels){
  assert.equal(model.runtime,'@huggingface/transformers@'+pkg.dependencies['@huggingface/transformers']);
  assert.equal(model.files.length,8);
  for(const file of model.files){assert.match(file.sha256,/^[a-f0-9]{64}$/);assert.equal(file.url,`https://huggingface.co/${model.repository}/resolve/${model.revision}/${file.path}`);assert.equal(speechFile(`/asr-model/${model.id}/${file.path}`),file);}
  assert.equal(capabilityState('audio.transcribe',model.id,false).status,'Not prepared');
  const audit=speechAssetInput(false,undefined,model.id);assert.equal(audit.model.id,model.id);assert.equal(audit.model.revision,model.revision);assert.equal(audit.files.length,8);
 }
 assert.equal(getSpeechManifest('unregistered'),undefined);
 assert.equal(speechFile('/asr-model/whisper-base/../whisper-tiny/config.json'),undefined);
});

test('speech status and offline verification never substitute another model cache or acquire missing files',async()=>{
 const saved={location:globalThis.location,caches:globalThis.caches,fetch:globalThis.fetch},lookups=[];
 globalThis.location={origin:'https://local.invalid'};
 globalThis.caches={open:async name=>({match:async url=>{lookups.push({name,url});return undefined;}})};
 let network=0;globalThis.fetch=async()=>{network++;throw Error('No network');};
 try{
  assert.equal(await speechReady('whisper-base'),false);
  await assert.rejects(()=>prepareSpeech(false,()=>{},'whisper-base'),/not prepared/);
  assert.equal(network,0);assert.ok(lookups.length>=2);
  assert.ok(lookups.every(item=>item.url.includes('/asr-model/whisper-base/')));
  assert.ok(lookups.every(item=>item.name.includes(getSpeechManifest('whisper-base').revision)));
 }finally{for(const [key,value] of Object.entries(saved)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});

test('transcripts retain selected built-in pins and accept historical tiny runtime records unchanged',async()=>{
 const asset=await prepareOriginal(new File(['audio'],'source.wav',{type:'audio/wav'}));
 const raw={text:'A recorded sentence.',chunks:[{text:'A recorded sentence.',timestamp:[0,1]}]};
 const base=makeTranscript(asset,1000,raw,'en',undefined,speechModelProvenance('whisper-base'));
 assert.equal(base.model.id,'whisper-base');validateTranscript(base,asset);
 const tiny=makeTranscript(asset,1000,raw);tiny.model.runtime='@huggingface/transformers@3.8.1';validateTranscript(tiny,asset);
 const {makeStateBackup,parseStateBackup}=await import('../src/backup-state.ts');
 const pack=await makeStateBackup({notes:[originalNote(asset),transcriptNote('base-result',asset,base),transcriptNote('legacy-result',asset,tiny)],settings:[],runs:[{key:originalKey(asset.id),value:asset}]});
 const restored=await parseStateBackup(JSON.stringify(pack));
 assert.deepEqual(restored.notes.find(note=>note.id==='base-result').transcription.model,base.model);
 assert.deepEqual(restored.notes.find(note=>note.id==='legacy-result').transcription.model,tiny.model);
 assert.throws(()=>validateTranscript({...base,model:{...base.model,revision:tiny.model.revision}},asset),/metadata/);
 assert.throws(()=>validateTranscript({...base,model:{...base.model,runtime:'@huggingface/transformers@3.8.1'}},asset),/metadata/);
});
