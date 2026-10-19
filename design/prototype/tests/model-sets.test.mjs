import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initialPreferenceNotes,readPreference,updatePreference} from '../src/preference-records.ts';
import {modelSets,applyModelSet,matchingModelSet} from '../src/model-sets.ts';
import {localAdapters} from '../src/local-capabilities.ts';
import {initialPreparationPlan} from '../src/initial-preparation.ts';

test('model sets only reference adapters already connected to app-owned local runtimes',()=>{
 assert.deepEqual(modelSets.map(set=>set.id),['bonsai-2b-text','bonsai-4b-text','bonsai-9b-text','text-compact','text-expanded','text-speech','text-image','text-vision','local-text-media','local-full']);
 for(const set of modelSets){
  assert.ok(set.models.textModel);
  assert.ok(['','d1-omni-600M'].includes(set.models.decisionModel));
  assert.ok(['','whisper-tiny'].includes(set.models.transcriptionModel));
  assert.ok(['','tesseract-7'].includes(set.models.ocrModel));
  assert.ok(['','lfm25-vl-450m-q4f16'].includes(set.models.visionModel));
  const roles=[['textModel','text.generate'],['decisionModel','decision.classify'],['transcriptionModel','audio.transcribe'],['ocrModel','image.ocr'],['visionModel','image.describe']];
  for(const [key,capability] of roles){const id=set.models[key];if(id)assert.ok(localAdapters.some(adapter=>adapter.models.includes(id)&&adapter.capabilities.includes(capability)),`${id} must have a connected ${capability} adapter`);}
 }
 assert.equal(matchingModelSet(readPreference('models',initialPreferenceNotes))?.id,'bonsai-4b-text');
});

test('the added sets vary supported roles without implying device verification or downloading assets',()=>{
 const expected={
  'bonsai-2b-text':['2B','','','',''],
  'bonsai-4b-text':['4B','','','',''],
  'bonsai-9b-text':['9B','','','',''],
  'text-compact':['lfm25-230m-qad-q4-0','','','',''],
  'text-expanded':['lfm25-350m-qad-q4-0','','','',''],
  'text-speech':['4B','','whisper-tiny','',''],
  'text-image':['4B','','','tesseract-7',''],
  'text-vision':['4B','','','','lfm25-vl-450m-q4f16'],
  'local-text-media':['4B','','whisper-tiny','tesseract-7',''],
  'local-full':['4B','d1-omni-600M','whisper-tiny','tesseract-7',''],
 };
 for(const set of modelSets){
  const model=set.models;
  assert.deepEqual([model.textModel,model.decisionModel,model.transcriptionModel,model.ocrModel,model.visionModel],expected[set.id]);
  assert.ok(set.detail.length>0);
  assert.equal('deviceVerified' in set,false);
  const before=readPreference('models',initialPreferenceNotes),after=applyModelSet(before,set.id);
  assert.equal(after.downloads,before.downloads);
 }
 assert.equal(modelSets.some(set=>set.models.decisionModel==='d1-3B'),false);
 assert.equal(modelSets.some(set=>set.models.transcriptionModel==='whisper-base'),false);
});

test('applying a set changes only model selections and adds their registered catalog IDs',()=>{
 const original=structuredClone(initialPreferenceNotes),before=readPreference('models',original);
 const next=updatePreference('models',original,current=>applyModelSet(current,'local-full'));
 const after=readPreference('models',next);
 assert.deepEqual({text:after.textModel,decision:after.decisionModel,speech:after.transcriptionModel,ocr:after.ocrModel,vision:after.visionModel},{text:'4B',decision:'d1-omni-600M',speech:'whisper-tiny',ocr:'tesseract-7',vision:''});
 assert.ok(after.textLibrary.includes('4B'));assert.ok(after.decisionLibrary.includes('d1-omni-600M'));
 assert.ok(after.transcriptionLibrary.includes('whisper-tiny'));assert.ok(after.ocrLibrary.includes('tesseract-7'));
 for(const key of Object.keys(before))if(!['textModel','decisionModel','transcriptionModel','ocrModel','visionModel','textLibrary','decisionLibrary','transcriptionLibrary','ocrLibrary','visionLibrary'].includes(key))assert.deepEqual(after[key],before[key],key);
 assert.equal(next.find(n=>n.id==='settings-models').version,2);
 assert.equal(matchingModelSet(after)?.id,'local-full');
});

test('applying a text-only set preserves registered libraries, custom declarations and every non-model record',()=>{
 const start=structuredClone(initialPreferenceNotes),registered=updatePreference('models',start,m=>({...m,textLibrary:[...m.textLibrary,'lfm25-230m-qad-q4-0'],decisionLibrary:['d1-omni-600M'],transcriptionLibrary:['whisper-tiny'],ocrLibrary:['tesseract-7'],decisionModel:'d1-omni-600M',transcriptionModel:'whisper-tiny',ocrModel:'tesseract-7'}));
 const snapshot=structuredClone(registered),next=updatePreference('models',registered,m=>applyModelSet(m,'text-compact'));
 const before=readPreference('models',snapshot),after=readPreference('models',next);
 assert.equal(after.textModel,'lfm25-230m-qad-q4-0');assert.equal(after.decisionModel,'');assert.equal(after.transcriptionModel,'');assert.equal(after.ocrModel,'');
 for(const key of ['textLibrary','decisionLibrary','transcriptionLibrary','ocrLibrary','customModels','customDecisionModels','customSpeechModels'])assert.deepEqual(after[key],before[key]);
 assert.deepEqual(next.filter(n=>n.id!=='settings-models'),snapshot.filter(n=>n.id!=='settings-models'));
 assert.throws(()=>applyModelSet(after,'unknown'),/Unknown model set/);
});

test('Bonsai 2 9B set selects a pinned text-only asset without claiming device verification',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../../../dist/model-manifest.json',import.meta.url),'utf8'));
 const model=manifest.models.find(item=>item.id==='9B');
 assert.equal(model.repository,'prism-ml/Ternary-Bonsai-2-9B-gguf');
 assert.equal(model.revision,'5b2abb02362efbed46bbe204014b02837778b2c2');
 assert.equal(model.file.bytes,1997486976);
 assert.equal(model.file.sha256,'3561df7ac7d26a71ffa991ac2db740b10841c3a350aa2676ccd3ff5d428b4e8b');
 assert.equal(model.format,'PTQ1_0');
 assert.equal(model.mmproj,null);
 assert.equal(model.generationVerified,false);
 const selected=applyModelSet(readPreference('models',initialPreferenceNotes),'bonsai-9b-text');
 assert.equal(selected.textModel,'9B');
 assert.equal(readPreference('connection',initialPreferenceNotes).downloads,false);
 assert.equal(matchingModelSet(selected)?.id,'bonsai-9b-text');
 const plan=initialPreparationPlan(selected,{text:false,speech:true,ocr:true});
 assert.equal(plan.steps[0].label,'Ternary Bonsai 2 9B');
 assert.equal(plan.steps[0].bytes,model.file.bytes+manifest.runtime.file.bytes);
});
