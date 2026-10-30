import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initialPreferenceNotes,readPreference,updatePreference,parsePreference,formatPreference} from '../src/preference-records.ts';
import {modelSets,modelSetsFor,createUserModelSet,applyModelSet,matchingModelSet,modelSetAssetBytes,modelSetGroup} from '../src/model-sets.ts';
import {localAdapters} from '../src/local-capabilities.ts';
import {initialPreparationPlan} from '../src/initial-preparation.ts';
import {settings} from '../src/app-settings.ts';

test('model sets only reference adapters already connected to app-owned local runtimes',()=>{
 assert.deepEqual(modelSets.map(set=>set.id),['lfm3-1.7b-qad-q4-0','lfm3-1.7b-q8-0','bonsai-2b-text','bonsai-4b-text','bonsai-9b-text','text-speech','text-image','text-vision','local-text-media','text-image-audio','text-image-audio-q8','local-full']);
 for(const set of modelSets){
  assert.ok(set.models.textModel);
  assert.ok(['','d1-omni-600M'].includes(set.models.decisionModel));
  assert.ok(['','whisper-tiny'].includes(set.models.transcriptionModel));
  assert.ok(['','tesseract-7'].includes(set.models.ocrModel));
  assert.ok(['','lfm25-vl-450m-q4f16'].includes(set.models.visionModel));
  const roles=[['textModel','text.generate'],['decisionModel','decision.classify'],['transcriptionModel','audio.transcribe'],['ocrModel','image.ocr'],['visionModel','image.describe']];
  for(const [key,capability] of roles){const id=set.models[key];if(id)assert.ok(localAdapters.some(adapter=>adapter.models.includes(id)&&adapter.capabilities.includes(capability)),`${id} must have a connected ${capability} adapter`);}
 }
 assert.equal(matchingModelSet(readPreference('models',initialPreferenceNotes))?.id,'lfm3-1.7b-qad-q4-0');
});

test('model set grouping separates text choices, added input roles, combined sets and saved sets without changing stored records',()=>{
 assert.equal(modelSetGroup('lfm3-1.7b-qad-q4-0'),'Text models');
 assert.equal(modelSetGroup('bonsai-9b-text'),'Text models');
 assert.equal(modelSetGroup('text-speech'),'Input sets');
 assert.equal(modelSetGroup('text-vision'),'Input sets');
 assert.equal(modelSetGroup('text-image-audio'),'Combined sets');
 assert.equal(modelSetGroup('local-full'),'Combined sets');
 assert.equal(modelSetGroup('user-reading-2'),'Saved by you');
 assert.throws(()=>modelSetGroup('unknown'),/Unknown model set/);
 const notes=structuredClone(initialPreferenceNotes),set=createUserModelSet(readPreference('models',notes),'Reading','Text only');
 const after=updatePreference('models',notes,current=>({...current,customSets:[...current.customSets,set]}));
 assert.equal(modelSetGroup(set.id),'Saved by you');
 assert.equal(after.find(note=>note.id==='settings-models').version,2);
 assert.deepEqual(readPreference('models',after).customSets,[set]);
});

test('task presets expose connected text choices without implying device verification or downloading assets',()=>{
 const expected={
  'lfm3-1.7b-qad-q4-0':['lfm3-1.7b-qad-q4-0','','','',''],
  'lfm3-1.7b-q8-0':['lfm3-1.7b-q8-0','','','',''],
  'bonsai-2b-text':['2B','','','',''],
  'bonsai-4b-text':['4B','','','',''],
  'bonsai-9b-text':['9B','','','',''],
  'text-speech':['lfm3-1.7b-qad-q4-0','','whisper-tiny','',''],
  'text-image':['lfm3-1.7b-qad-q4-0','','','tesseract-7',''],
  'text-vision':['lfm3-1.7b-qad-q4-0','','','','lfm25-vl-450m-q4f16'],
  'local-text-media':['lfm3-1.7b-qad-q4-0','','whisper-tiny','tesseract-7',''],
  'text-image-audio':['lfm3-1.7b-qad-q4-0','','whisper-tiny','tesseract-7','lfm25-vl-450m-q4f16'],
  'text-image-audio-q8':['lfm3-1.7b-q8-0','','whisper-tiny','tesseract-7','lfm25-vl-450m-q4f16'],
  'local-full':['lfm3-1.7b-qad-q4-0','d1-omni-600M','whisper-tiny','tesseract-7',''],
 };
 for(const set of modelSets){
  const model=set.models;
  assert.deepEqual([model.textModel,model.decisionModel,model.transcriptionModel,model.ocrModel,model.visionModel],expected[set.id]);
  assert.ok(set.detail.length>0);
  assert.equal('deviceVerified' in set,false);
  const before=readPreference('models',initialPreferenceNotes),after=applyModelSet(before,set.id);
  assert.equal(after.downloads,before.downloads);
 }
 assert.equal(modelSets.find(set=>set.id==='lfm3-1.7b-qad-q4-0').detail,'Text · WebGPU first');
 assert.equal(modelSets.find(set=>set.id==='lfm3-1.7b-q8-0').detail,'Text · WebGPU first · 1.85 GB');
 const d1=settings.models.decision.find(model=>model.value==='d1-omni-600M');
 assert.equal(d1.label,'Open d1 · 600M · Text decision');
 assert.equal(modelSets.find(set=>set.id==='local-full').label,'Text + voice + OCR + decision');
 assert.match(modelSets.find(set=>set.id==='local-full').detail,/text decisions only · no image understanding/);
 assert.equal(modelSets.some(set=>set.models.decisionModel==='d1-3B'),false);
 assert.equal(modelSets.some(set=>set.models.transcriptionModel==='whisper-base'),false);
 assert.equal(modelSets.some(set=>['lfm25-230m-qad-q4-0','lfm25-350m-qad-q4-0'].includes(set.models.textModel)),false);
});

test('applying a set changes only model selections and adds their registered catalog IDs',()=>{
 const original=structuredClone(initialPreferenceNotes),before=readPreference('models',original);
 const next=updatePreference('models',original,current=>applyModelSet(current,'local-full'));
 const after=readPreference('models',next);
 assert.deepEqual({text:after.textModel,decision:after.decisionModel,speech:after.transcriptionModel,ocr:after.ocrModel,vision:after.visionModel},{text:'lfm3-1.7b-qad-q4-0',decision:'d1-omni-600M',speech:'whisper-tiny',ocr:'tesseract-7',vision:''});
 assert.ok(after.textLibrary.includes('lfm3-1.7b-qad-q4-0'));assert.ok(after.decisionLibrary.includes('d1-omni-600M'));
 assert.ok(after.transcriptionLibrary.includes('whisper-tiny'));assert.ok(after.ocrLibrary.includes('tesseract-7'));
 for(const key of Object.keys(before))if(!['textModel','decisionModel','transcriptionModel','ocrModel','visionModel','textLibrary','decisionLibrary','transcriptionLibrary','ocrLibrary','visionLibrary'].includes(key))assert.deepEqual(after[key],before[key],key);
 assert.equal(next.find(n=>n.id==='settings-models').version,2);
 assert.equal(matchingModelSet(after)?.id,'local-full');
});

test('applying a text-only set preserves registered libraries, custom declarations and every non-model record',()=>{
 const start=structuredClone(initialPreferenceNotes),registered=updatePreference('models',start,m=>({...m,textLibrary:[...m.textLibrary,'smollm2-360m-instruct'],decisionLibrary:['d1-omni-600M'],transcriptionLibrary:['whisper-tiny'],ocrLibrary:['tesseract-7'],decisionModel:'d1-omni-600M',transcriptionModel:'whisper-tiny',ocrModel:'tesseract-7'}));
 const snapshot=structuredClone(registered),next=updatePreference('models',registered,m=>applyModelSet(m,'bonsai-2b-text'));
 const before=readPreference('models',snapshot),after=readPreference('models',next);
 assert.equal(after.textModel,'2B');assert.equal(after.decisionModel,'');assert.equal(after.transcriptionModel,'');assert.equal(after.ocrModel,'');
 for(const key of ['textLibrary','decisionLibrary','transcriptionLibrary','ocrLibrary','customModels','customDecisionModels','customSpeechModels'])assert.deepEqual(after[key],before[key]);
 assert.deepEqual(next.filter(n=>n.id!=='settings-models'),snapshot.filter(n=>n.id!=='settings-models'));
 assert.throws(()=>applyModelSet(after,'unknown'),/Unknown model set/);
});

test('less-used text candidates remain preserved when another preset is applied',()=>{
 const legacy=updatePreference('models',structuredClone(initialPreferenceNotes),value=>({...value,textLibrary:[...value.textLibrary,'9B','lfm25-230m-qad-q4-0','lfm25-350m-qad-q4-0'],textModel:'lfm25-230m-qad-q4-0'}));
 const loaded=readPreference('models',legacy);
 assert.equal(loaded.textModel,'lfm25-230m-qad-q4-0');
 assert.ok(loaded.textLibrary.includes('9B'));
 assert.ok(loaded.textLibrary.includes('lfm25-350m-qad-q4-0'));
 assert.equal(applyModelSet(loaded,'bonsai-9b-text').textModel,'9B');
 assert.throws(()=>applyModelSet(loaded,'text-compact'),/Unknown model set/);
});

test('user model sets are validated in Memory and join the same reviewed selection catalog',()=>{
 const set={id:'user-reading',label:'Reading',detail:'Small local text model',models:{textModel:'2B',decisionModel:'',transcriptionModel:'',ocrModel:'',visionModel:''}};
 const notes=updatePreference('models',structuredClone(initialPreferenceNotes),value=>({...value,customSets:[set]}));
 const value=readPreference('models',notes);
 assert.deepEqual(value.customSets,[set]);
 assert.deepEqual(modelSetsFor(value)[0],set);
 const applied=applyModelSet(value,set.id);
 assert.equal(applied.textModel,'2B');
 assert.equal(matchingModelSet(applied)?.id,set.id);
 assert.equal(applied.customSets.length,1);
 assert.equal(modelSetAssetBytes(value,set.id),modelSetAssetBytes(value,'bonsai-2b-text'));
 assert.equal(notes.find(note=>note.id==='settings-models').version,2);
 assert.deepEqual(notes.find(note=>note.id==='settings-models').history,[initialPreferenceNotes.find(note=>note.id==='settings-models').body]);
});

test('saving current model choices creates a stable Memory ID without preparing or selecting anything',()=>{
 const value=readPreference('models',initialPreferenceNotes),before=structuredClone(value);
 const first=createUserModelSet(value,'Local Reader','A local reader profile');
 assert.equal(first.id,'user-localreader');
 assert.deepEqual(first.models,{textModel:value.textModel,decisionModel:value.decisionModel,transcriptionModel:value.transcriptionModel,ocrModel:value.ocrModel,visionModel:value.visionModel});
 const second=createUserModelSet({...value,customSets:[first]},'Local Reader','A second saved profile');
 assert.equal(second.id,'user-localreader-2');
 assert.deepEqual(value,before);
 assert.throws(()=>createUserModelSet(value,'','Missing name'),/Set name/);
 assert.throws(()=>createUserModelSet({...value,textModel:''},'Empty','No text model'),/Text model/);
});

test('legacy model Memory records read an empty set list without rewriting their stored revision',()=>{
 const notes=structuredClone(initialPreferenceNotes),record=notes.find(note=>note.id==='settings-models'),legacy=readPreference('models',notes);
 delete legacy.customSets;record.body=formatPreference('models',legacy).replace('  "schemaVersion": 1,\n','');const storedBytes=record.body;
 assert.deepEqual(readPreference('models',notes).customSets,[]);
 assert.equal(record.body,storedBytes);assert.equal(record.version,1);assert.deepEqual(record.history,[]);
});

test('Memory model sets reject unregistered roles, unsafe IDs, collisions and malformed records',()=>{
 const base=readPreference('models',initialPreferenceNotes),set={id:'user-reading',label:'Reading',detail:'A local profile',models:{textModel:'2B',decisionModel:'',transcriptionModel:'',ocrModel:'',visionModel:''}};
 const invalid=[
  {...set,id:'bonsai-4b-text'},
  {...set,id:'user-unsafe/path'},
  {...set,models:{...set.models,decisionModel:'d1-omni-600M'}},
  {...set,models:{...set.models,textModel:'remote-model'}},
  {...set,extra:true},
 ];
 for(const item of invalid)assert.throws(()=>updatePreference('models',structuredClone(initialPreferenceNotes),value=>({...value,customSets:[item]})));
 assert.throws(()=>updatePreference('models',structuredClone(initialPreferenceNotes),value=>({...value,customSets:[set,{...set,label:'Duplicate'}]})));
 const unavailable={...base,textLibrary:[],customSets:[set]};
 assert.throws(()=>parsePreference('models',formatPreference('models',unavailable)),/model|registry/i);
});

test('Bonsai 2 9B can be selected as an explicit set without claiming device acceptance',async()=>{
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

test('every visible standard set reports its cold model asset bytes before selection',()=>{
 const before=readPreference('models',initialPreferenceNotes),snapshot=structuredClone(before);
 const sizes=new Map(modelSets.map(set=>[set.id,modelSetAssetBytes(before,set.id)]));
 assert.equal(sizes.size,modelSets.length);
 for(const [id,bytes] of sizes)assert.ok(Number.isSafeInteger(bytes)&&bytes>0,`${id} needs a pinned asset total`);
 assert.ok(sizes.get('bonsai-4b-text')>sizes.get('bonsai-2b-text'));
 assert.ok(sizes.get('bonsai-9b-text')>sizes.get('bonsai-4b-text'));
 assert.ok(sizes.get('local-full')>sizes.get('bonsai-4b-text'));
 assert.ok(sizes.get('text-image-audio')>sizes.get('local-text-media'));
 assert.deepEqual(before,snapshot);
 assert.equal(readPreference('connection',initialPreferenceNotes).downloads,false);
});

test('image and audio set prepares only its selected local readers',()=>{
 const selected=applyModelSet(readPreference('models',initialPreferenceNotes),'text-image-audio');
 assert.equal(matchingModelSet(selected)?.id,'text-image-audio');
 const plan=initialPreparationPlan(selected,{text:false,speech:false,ocr:false,vision:false});
 assert.deepEqual(plan.steps.map(step=>step.role),['text','speech','ocr','vision']);
 assert.equal(plan.steps.some(step=>step.role==='decision'),false);
 assert.equal(plan.bytes,modelSetAssetBytes(readPreference('models',initialPreferenceNotes),'text-image-audio'));
});

test('Q8 can be selected with image and audio without changing existing model preferences',()=>{
 const before=readPreference('models',initialPreferenceNotes),snapshot=structuredClone(before);
 const selected=applyModelSet(before,'text-image-audio-q8');
 assert.equal(selected.textModel,'lfm3-1.7b-q8-0');assert.equal(selected.transcriptionModel,'whisper-tiny');
 assert.equal(selected.ocrModel,'tesseract-7');assert.equal(selected.visionModel,'lfm25-vl-450m-q4f16');assert.equal(selected.decisionModel,'');
 assert.deepEqual(before,snapshot);assert.equal(readPreference('connection',initialPreferenceNotes).downloads,false);
 assert.equal(matchingModelSet(selected)?.id,'text-image-audio-q8');
 const plan=initialPreparationPlan(selected,{text:false,speech:false,ocr:false,vision:false});
 assert.deepEqual(plan.steps.map(step=>step.role),['text','speech','ocr','vision']);assert.equal(plan.bytes,modelSetAssetBytes(before,'text-image-audio-q8'));
});
