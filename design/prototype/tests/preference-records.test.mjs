import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {initialPreferenceNotes,readPreference,readPreferenceWithFallback,recoverPreferenceRecord,restoreDefaultPreferences,updatePreference,parsePreference,formatPreference} from '../src/preference-records.ts';
import {createNote} from '../../../dist/core.js';
import {makeStateBackup,parseStateBackup,planStateRestore} from '../src/backup-state.ts';
import {settingsPatchResult} from '../src/settings-corrections.ts';
import {settings} from '../src/app-settings.ts';
import {deletionContents} from '../src/memory-trash.ts';

function legacyPreference(group,value){return formatPreference(group,value).replace('  "schemaVersion": 1,\n','');}

test('a user-selected speech language persists as a new models settings revision',()=>{
 const initial=structuredClone(initialPreferenceNotes),before=readPreference('models',initial),changed=updatePreference('models',initial,value=>({...value,transcriptionLanguage:'ja'}));
 assert.equal(readPreference('models',changed).transcriptionLanguage,'ja');assert.equal(readPreference('models',initial).transcriptionLanguage,before.transcriptionLanguage);
 const old=initial.find(note=>note.id==='settings-models'),next=changed.find(note=>note.id==='settings-models');assert.equal(next.version,old.version+1);assert.equal(next.history.at(-1),old.body);
});

test('Settings README is a memory-file index with an explicit extension boundary',()=>{
 const readme=initialPreferenceNotes.find(note=>note.id==='settings-readme');
 assert.ok(readme?.protected);
 for(const path of ['Settings/models.md','Settings/appearance.md','Settings/connection.md','Settings/harness.md','Tools/user.<id>/SKILL.md','tool.js'])assert.ok(readme.body.includes(path),`missing ${path}`);
 assert.match(readme.body,/local Memory records shared with the Settings screen/i);
 assert.match(readme.body,/revision history/i);
 assert.match(readme.body,/named model sets/i);
 assert.match(readme.body,/New setting types need an app schema, validator and consumer/i);
 assert.ok(readme.body.includes('Saving a package adds it to the active profile'));
});

test('view edits produce a canonical settings revision retaining original bytes and ID',()=>{
 const original=structuredClone(initialPreferenceNotes),before=original.find(n=>n.id==='settings-appearance');
 const changed=updatePreference('appearance',original,p=>({...p,background:'sand'}));
 const after=changed.find(n=>n.id===before.id);
 assert.equal(readPreference('appearance',changed).background,'sand');
 assert.equal(after.path,before.path);assert.equal(after.version,2);assert.deepEqual(after.history,[before.body]);
 assert.equal(readPreference('appearance',original).background,'paper');
});
test('settings files carry a schema version and legacy records migrate only in memory until an explicit save',()=>{
 for(const group of ['models','appearance','connection','harness'])assert.equal(readPreference(group,initialPreferenceNotes).schemaVersion,1);
 const records=structuredClone(initialPreferenceNotes),target=records.find(note=>note.id==='settings-appearance'),legacy={...readPreference('appearance',records)};delete legacy.paletteRegistry;delete legacy.activePaletteId;
 target.body=legacyPreference('appearance',legacy);const oldBytes=target.body,projected=readPreference('appearance',records);
 assert.equal(projected.schemaVersion,1);assert.equal(target.body,oldBytes);assert.equal(target.version,1);
 const saved=updatePreference('appearance',records,value=>({...value,background:'sand'})),record=saved.find(note=>note.id===target.id);
 assert.equal(readPreference('appearance',saved).schemaVersion,1);assert.equal(record.history[0],oldBytes);assert.equal(JSON.parse(record.body.match(/```json\n([\s\S]+)\n```/)[1]).schemaVersion,1);
});
test('appearance settings migrate a single legacy palette in memory and retain a named editable registry',()=>{
 const notes=structuredClone(initialPreferenceNotes),record=notes.find(note=>note.id==='settings-appearance'),legacy=readPreference('appearance',notes);
 delete legacy.paletteRegistry;delete legacy.activePaletteId;
 const night={name:'Night garden',canvas:'#101820',text:'#f2f5f7',surface:'#203040',surfaceText:'#f2f5f7',accent:'#76e3c1',accentText:'#102018',muted:'#d1dae1',border:'#506070'};
 legacy.palette=night;record.body=legacyPreference('appearance',legacy);const legacyBytes=record.body;
 const migrated=readPreference('appearance',notes);
 assert.equal(migrated.activePaletteId,'palette-legacy');assert.deepEqual(migrated.paletteRegistry,[{id:'palette-legacy',...night}]);
 assert.equal(record.body,legacyBytes);assert.equal(record.version,1);assert.deepEqual(record.history,[]);
 const second={id:'palette-daylight',name:'Daylight',canvas:'#ffffff',text:'#101820',surface:'#f4f7f6',surfaceText:'#101820',accent:'#005d3c',accentText:'#ffffff',muted:'#3c4b46',border:'#708078'};
 const updated=updatePreference('appearance',notes,current=>({...current,paletteRegistry:[...current.paletteRegistry,second],activePaletteId:second.id}));
 const saved=readPreference('appearance',updated),nextRecord=updated.find(note=>note.id===record.id);
 assert.equal(saved.activePaletteId,second.id);assert.deepEqual(saved.paletteRegistry,[{id:'palette-legacy',...night},second]);
 assert.equal(nextRecord.version,2);assert.deepEqual(nextRecord.history,[legacyBytes]);
 for(const change of [value=>({...value,activePaletteId:'palette-missing'}),value=>({...value,paletteRegistry:[second,{...second,name:'Other'}]}),value=>({...value,paletteRegistry:Array.from({length:13},(_,index)=>({...second,id:`palette-${index}`,name:`Palette ${index}`}))})]){
  assert.throws(()=>updatePreference('appearance',notes,change),/palette/i);
 }
});
test('harness reply style is finite, versioned and defaults forward for older records',()=>{
 const records=structuredClone(initialPreferenceNotes),record=records.find(n=>n.id==='settings-harness'),value=readPreference('harness',records);
 assert.equal(value.replyStyle,'balanced');
 const legacy={...value};delete legacy.replyStyle;delete legacy.userGuidance;record.body=legacyPreference('harness',legacy);
 assert.equal(readPreference('harness',records).replyStyle,'balanced');assert.equal(readPreference('harness',records).userGuidance,'');
 const changed=updatePreference('harness',records,current=>({...current,replyStyle:'concise'}));
 assert.equal(readPreference('harness',changed).replyStyle,'concise');assert.equal(changed.find(n=>n.id===record.id).version,2);
 assert.throws(()=>updatePreference('harness',records,current=>({...current,replyStyle:'ignore safety'})),/profile registry/);
});
test('harness user guidance is bounded, versioned text and remains configuration data',()=>{
 const original=structuredClone(initialPreferenceNotes),guidance='Prefer short Japanese answers and show the relevant memory path when useful.';
 const changed=updatePreference('harness',original,current=>({...current,userGuidance:guidance}));
 assert.equal(readPreference('harness',changed).userGuidance,guidance);assert.equal(changed.find(n=>n.id==='settings-harness').version,2);
 assert.throws(()=>updatePreference('harness',original,current=>({...current,userGuidance:'x'.repeat(2049)})),/user guidance/i);
 assert.throws(()=>updatePreference('harness',original,current=>({...current,userGuidance:'x'.repeat(2048)+'日'})),/user guidance/i);
 assert.throws(()=>updatePreference('harness',original,current=>({...current,userGuidance:'bad\u0000text'})),/user guidance/i);
});
test('file edits reject malformed values and execution/readiness fields without changing active records',()=>{
 const original=structuredClone(initialPreferenceNotes);
 assert.throws(()=>updatePreference('appearance',original,p=>({...p,theme:'unknown'})),/appearance/);
 assert.equal(readPreference('appearance',original).theme,'light');
 assert.throws(()=>parsePreference('connection','# Connection\n\n```json\n{"downloads":true,"remoteInference":true}\n```'),/Unknown/);
 assert.throws(()=>parsePreference('models',formatPreference('models',{...readPreference('models',original),ready:true})),/Unknown/);
 const edited=formatPreference('connection',{downloads:true,diagnosticLogs:false});assert.equal(parsePreference('connection',edited).downloads,true);assert.equal(parsePreference('connection',edited).diagnosticLogs,false);
});
test('diagnostic logging defaults off and legacy connection preferences migrate without rewriting their bytes',()=>{
 const records=structuredClone(initialPreferenceNotes),record=records.find(n=>n.id==='settings-connection'),legacy='# Connection\n\n```json\n{"downloads":false}\n```\n';record.body=legacy;
 assert.equal(readPreference('connection',records).diagnosticLogs,false);assert.equal(record.body,legacy);
 const enabled=updatePreference('connection',records,value=>({...value,diagnosticLogs:true}));assert.equal(readPreference('connection',enabled).diagnosticLogs,true);assert.equal(enabled.find(n=>n.id===record.id).history[0],legacy);
});
test('model selections reference the library and managed settings cannot be deleted',()=>{
 const original=structuredClone(initialPreferenceNotes);
 assert.throws(()=>updatePreference('models',original,m=>({...m,transcriptionModel:'whisper-tiny'})),/before selecting/);
 const registered=updatePreference('models',original,m=>({...m,transcriptionLibrary:['whisper-tiny'],transcriptionModel:'whisper-tiny'}));
 assert.equal(readPreference('models',registered).transcriptionModel,'whisper-tiny');
 assert.throws(()=>deletionContents({kind:'file',value:'settings-models'},original,['Settings']),/protected/);
});

test('fresh settings select LFM3 and retain Bonsai alternatives in the library',()=>{
 const models=readPreference('models',initialPreferenceNotes);
 assert.deepEqual(models.textLibrary,['lfm3-1.7b-qad-q4-0','2B']);
 assert.equal(models.textModel,'lfm3-1.7b-qad-q4-0');
 assert.equal(models.decisionModel,'');
 assert.equal(models.customModels.length,0);
});

test('changing the fresh default never rewrites an existing selected model record',()=>{
 const notes=structuredClone(initialPreferenceNotes),record=notes.find(note=>note.id==='settings-models');
 const legacy=readPreference('models',notes);legacy.textModel='4B';legacy.textLibrary=['4B','2B'];
 record.body=formatPreference('models',legacy);
 const before=record.body,loaded=readPreference('models',notes);
 assert.equal(settings.defaults.textModel,'lfm3-1.7b-qad-q4-0');
 assert.equal(loaded.textModel,'4B');assert.deepEqual(loaded.textLibrary,['4B','2B']);
 assert.equal(record.body,before);
});

test('harness profiles live in versioned Memory settings and only reduce registered tool authority',()=>{
 const records=structuredClone(initialPreferenceNotes),before=readPreference('harness',records);
 assert.equal(before.activeProfileId,'standard');
 assert.deepEqual(before.profiles.map(profile=>profile.id),['standard','source-first','conversation']);
 const standard=before.profiles[0];assert.deepEqual(standard.enabledTools,['memory.search','memory.list','memory.read','math.calculate','time.now']);assert.equal(standard.maxToolCalls,null);assert.equal(standard.maxResultChars,8000);
 const changed=updatePreference('harness',records,value=>({...value,activeProfileId:'source-first',profiles:value.profiles.map(profile=>profile.id==='source-first'?{...profile,enabledTools:['memory.search'],maxToolCalls:1,maxResultChars:1200}:profile)}));
 const saved=readPreference('harness',changed),record=changed.find(note=>note.id==='settings-harness');
 assert.equal(saved.activeProfileId,'source-first');assert.deepEqual(saved.profiles.find(profile=>profile.id==='source-first').enabledTools,['memory.search']);
 assert.equal(saved.profiles.find(profile=>profile.id==='source-first').maxToolCalls,1);assert.equal(saved.profiles.find(profile=>profile.id==='source-first').maxResultChars,1200);
 assert.equal(record.version,2);assert.equal(record.history[0],records.find(note=>note.id==='settings-harness').body);
});

test('harness profile accepts only namespaced custom tool IDs for later registry verification',()=>{
 const records=structuredClone(initialPreferenceNotes),before=readPreference('harness',records);
 const changed=updatePreference('harness',records,value=>({...value,profiles:value.profiles.map(profile=>profile.id==='standard'?{...profile,enabledTools:[...profile.enabledTools,'user.lookup']}:profile)}));
 assert.ok(readPreference('harness',changed).profiles[0].enabledTools.includes('user.lookup'));
 for(const id of ['user.', 'user.lookup.extra','network.fetch','memory.write'])assert.throws(()=>updatePreference('harness',structuredClone(records),value=>({...value,profiles:value.profiles.map(profile=>profile.id==='standard'?{...profile,enabledTools:[...profile.enabledTools,id]}:profile)})));
 assert.equal(before.activeProfileId,'standard');
});

test('existing standard profile keeps its tool selection after a new tool is added',()=>{
 const records=structuredClone(initialPreferenceNotes),record=records.find(note=>note.id==='settings-harness');
 const old=parsePreference('harness',record.body);old.profiles[0].enabledTools=old.profiles[0].enabledTools.filter(id=>id!=='time.now');
 record.body=formatPreference('harness',old);const before=record.body;
 assert.equal(parsePreference('harness',record.body).profiles[0].enabledTools.includes('time.now'),false);assert.equal(record.body,before);
});

test('harness config rejects unknown tools, invalid budgets and non-read-only capabilities',()=>{
 const initial=readPreference('harness',initialPreferenceNotes);
 for(const mutate of [
  value=>({...value,profiles:value.profiles.map(profile=>profile.id==='standard'?{...profile,enabledTools:['memory.delete']}:profile)}),
  value=>({...value,profiles:value.profiles.map(profile=>profile.id==='standard'?{...profile,maxToolCalls:-1}:profile)}),
  value=>({...value,profiles:value.profiles.map(profile=>profile.id==='standard'?{...profile,maxResultChars:8001}:profile)}),
  value=>({...value,writeTools:['memory.patch']}),
 ])assert.throws(()=>parsePreference('harness',formatPreference('harness',mutate(initial))),/Unknown|Unsupported|Invalid|invalid|exceed/);
});

test('legacy untouched built-in tools and caps migrate additively without changing custom limits',()=>{
 const current=structuredClone(initialPreferenceNotes),record=current.find(note=>note.id==='settings-harness');
 const legacy=parsePreference('harness',record.body);legacy.schemaVersion=1;legacy.profiles[0].maxToolCalls=8;legacy.profiles[1].maxToolCalls=2;legacy.profiles[2].maxToolCalls=0;
 record.body=formatPreference('harness',legacy).replace('"schemaVersion": 2','"schemaVersion": 1');const parsed=parsePreference('harness',record.body);
 assert.equal(parsed.schemaVersion,1);assert.deepEqual(parsed.profiles[0].enabledTools,['memory.search','memory.list','memory.read','math.calculate','time.now']);assert.deepEqual(parsed.profiles[1].enabledTools,['memory.search','memory.list','memory.read']);assert.equal(parsed.profiles[0].maxToolCalls,null);assert.equal(parsed.profiles[1].maxToolCalls,null);assert.equal(parsed.profiles[2].maxToolCalls,0);
 legacy.schemaVersion=1;legacy.profiles[0].maxToolCalls=4;record.body=formatPreference('harness',legacy).replace('"schemaVersion": 2','"schemaVersion": 1');
 assert.equal(parsePreference('harness',record.body).profiles[0].maxToolCalls,4);
});

test('all roles require registration; old model records migrate without losing history',()=>{
 const original=structuredClone(initialPreferenceNotes),before=original.find(n=>n.id==='settings-models');
 assert.throws(()=>updatePreference('models',original,m=>({...m,textModel:'smollm2-360m-instruct'})),/before selecting/);
 assert.throws(()=>updatePreference('models',original,m=>({...m,decisionModel:'d1-3B'})),/before selecting/);
 const registered=updatePreference('models',original,m=>({...m,textLibrary:[...m.textLibrary,'smollm2-360m-instruct'],textModel:'smollm2-360m-instruct',decisionLibrary:['d1-3B'],decisionModel:'d1-3B'}));
 assert.equal(readPreference('models',registered).textModel,'smollm2-360m-instruct');
 assert.deepEqual(registered.find(n=>n.id===before.id).history,[before.body]);
 const legacy={...readPreference('models',original)};delete legacy.textLibrary;delete legacy.decisionLibrary;
 const body=legacyPreference('models',legacy),parsed=parsePreference('models',body);
 assert.deepEqual(parsed.textLibrary,['lfm3-1.7b-qad-q4-0']);assert.deepEqual(parsed.decisionLibrary,[]);
 const older=original.map(n=>n.id===before.id?{...n,body}:n);
 const changed=updatePreference('models',older,m=>({...m,textLibrary:['lfm3-1.7b-qad-q4-0','2B'],textModel:'2B'}));
 assert.deepEqual(changed.find(n=>n.id===before.id).history,[body]);
});

test('legacy model settings project OCR defaults without rewriting bytes; explicit registration appends history',()=>{
 const notes=structuredClone(initialPreferenceNotes),old=notes.find(n=>n.id==='settings-models'),value=readPreference('models',notes);delete value.ocrModel;delete value.ocrLibrary;delete value.ocrLanguage;old.body=legacyPreference('models',value);const bytes=old.body,parsed=readPreference('models',notes);assert.equal(old.body,bytes);assert.equal(parsed.ocrModel,'');assert.deepEqual(parsed.ocrLibrary,[]);assert.equal(parsed.ocrLanguage,'eng+jpn');const next=updatePreference('models',notes,m=>({...m,ocrLibrary:['tesseract-7'],ocrModel:'tesseract-7'}));assert.equal(next.find(n=>n.id===old.id).history[0],bytes);assert.equal(readPreference('models',next).textModel,parsed.textModel);assert.throws(()=>parsePreference('models',formatPreference('models',{...parsed,ocrModel:'remote-ocr'})),/Unsupported/);
});
test('legacy model preferences gain the conservative LFM3 context default without rewriting saved bytes',()=>{
 const notes=structuredClone(initialPreferenceNotes),record=notes.find(n=>n.id==='settings-models'),legacy=readPreference('models',notes);delete legacy.lfm3ContextTokens;legacy.textModel='2B';record.body=legacyPreference('models',legacy);const original=record.body;
 const migrated=readPreference('models',notes);assert.equal(migrated.lfm3ContextTokens,8192);assert.equal(migrated.textModel,'2B');assert.equal(record.body,original);assert.equal(record.version,1);
 const saved=updatePreference('models',notes,value=>({...value,lfm3ContextTokens:262144}));assert.equal(readPreference('models',saved).lfm3ContextTokens,262144);assert.equal(saved.find(n=>n.id===record.id).history[0],original);
 assert.throws(()=>updatePreference('models',notes,value=>({...value,lfm3ContextTokens:524288})),/context window/);
});
test('Vision selection is independently registered, defaults off, and legacy settings migrate without rewriting bytes',()=>{
 const notes=structuredClone(initialPreferenceNotes),record=notes.find(n=>n.id==='settings-models'),value=readPreference('models',notes);
 assert.equal(value.visionModel,'');assert.deepEqual(value.visionLibrary,[]);
 delete value.visionModel;delete value.visionLibrary;record.body=legacyPreference('models',value);const old=record.body;
 const migrated=readPreference('models',notes);assert.equal(migrated.visionModel,'');assert.deepEqual(migrated.visionLibrary,[]);assert.equal(record.body,old);
 assert.throws(()=>updatePreference('models',notes,m=>({...m,visionModel:'lfm25-vl-450m-q4f16'})),/Unsupported vision model/);
 const registered=updatePreference('models',notes,m=>({...m,visionLibrary:['lfm25-vl-450m-q4f16'],visionModel:'lfm25-vl-450m-q4f16'}));
 assert.equal(readPreference('models',registered).visionModel,'lfm25-vl-450m-q4f16');
 assert.equal(registered.find(n=>n.id==='settings-models').history.at(-1),old);
 assert.throws(()=>parsePreference('models',formatPreference('models',{...migrated,visionLibrary:['unknown']})),/Unsupported vision model/);
});

const custom=()=>{const sha256='b'.repeat(64);return {id:'local-'+sha256,label:'My fine tune',role:'text',engine:'webml-qwen35',revision:'sha256:'+sha256,file:{bytes:1000,sha256},contextTokens:2048,inspection:{format:'GGUF',version:3,bytes:1000,name:'Custom',architecture:'qwen35',contextLength:4096,tokenizer:'gpt2',chatTemplate:true,tokenCount:1024,tensorCount:1,tensorTypes:[143],tensorExtentsChecked:true,dataOffset:512}};};
const customDecision=()=>{const files=[{path:'config.json',bytes:1000,sha256:'1'.repeat(64)},{path:'tokenizer.json',bytes:1000,sha256:'2'.repeat(64)},{path:'tokenizer_config.json',bytes:1000,sha256:'3'.repeat(64)},{path:'onnx/model_quantized.onnx',bytes:1000,sha256:'4'.repeat(64)},{path:'onnx/model_quantized.onnx_data',bytes:1000,sha256:'5'.repeat(64)}],sha256=createHash('sha256').update(JSON.stringify(files)).digest('hex');return {id:'local-decision-'+sha256,label:'Fine-tuned D1',role:'decision',engine:'onnx-d1-text',revision:'sha256:'+sha256,files,inspection:{format:'D1-ONNX',architecture:'d1_omni',contextTokens:16384,inputLimit:2048,scope:'text-only'}};};
const customSpeech=()=>{const files=['config.json','generation_config.json','preprocessor_config.json','tokenizer.json','tokenizer_config.json','special_tokens_map.json','onnx/encoder_model_quantized.onnx','onnx/decoder_model_merged_quantized.onnx'].map((path,i)=>({path,bytes:1000,sha256:String(i+1).repeat(64)})),sha256=createHash('sha256').update(JSON.stringify(files)).digest('hex');return {id:'local-speech-'+sha256,label:'Local Whisper',role:'speech',engine:'transformers-whisper-onnx',revision:'sha256:'+sha256,files,inspection:{format:'Whisper-ONNX',architecture:'whisper',device:'wasm',dtype:'q8',maxDurationSeconds:120}};};
const customVision=()=>{const paths=['chat_template.jinja','config.json','generation_config.json','preprocessor_config.json','processor_config.json','tokenizer.json','tokenizer_config.json','onnx/decoder_model_merged_q4f16.onnx','onnx/decoder_model_merged_q4f16.onnx_data','onnx/embed_tokens_q4f16.onnx','onnx/embed_tokens_q4f16.onnx_data','onnx/vision_encoder_q4f16.onnx','onnx/vision_encoder_q4f16.onnx_data'],files=paths.map((path,i)=>({path,bytes:1000,sha256:'0123456789abcdef'[i].repeat(64)})),sha256=createHash('sha256').update(JSON.stringify(files)).digest('hex');return {id:'local-vision-'+sha256,label:'My LFM2-VL',role:'vision',engine:'transformers-lfm2-vl-onnx',revision:'sha256:'+sha256,files,inspection:{format:'LFM2-VL-ONNX',architecture:'lfm2_vl',device:'webgpu',dtype:'q4f16',maxImageTokens:256,scope:'image-text'}};};
test('custom model declarations persist through canonical revisions without inventing readiness',()=>{
 const notes=structuredClone(initialPreferenceNotes),old=notes.find(n=>n.id==='settings-models'),legacy=readPreference('models',notes);delete legacy.customModels;old.body=legacyPreference('models',legacy);const body=old.body;
 assert.deepEqual(readPreference('models',notes).customModels,[]);assert.equal(old.body,body);
 const model=custom(),updated=updatePreference('models',notes,m=>({...m,customModels:[model],textLibrary:[...m.textLibrary,model.id],textModel:model.id}));
 assert.equal(readPreference('models',updated).textModel,model.id);assert.deepEqual(readPreference('models',updated).customModels,[model]);assert.deepEqual(updated.find(n=>n.id===old.id).history,[body]);
 for(const change of [m=>m.customModels.push(model),m=>m.customModels[0].ready=true,m=>m.customModels[0].file.url='https://example.com',m=>m.customModels=[],m=>m.customModels[0].engine='unknown']){
  const value=structuredClone(readPreference('models',updated));change(value);assert.throws(()=>parsePreference('models',formatPreference('models',value)));
 }
});
test('legacy custom GGUF context reads as the safe default without rewriting its stored settings bytes',()=>{
 const notes=structuredClone(initialPreferenceNotes),model=custom();delete model.contextTokens;const source=notes.find(n=>n.id==='settings-models');const prefs=readPreference('models',notes);prefs.customModels=[model];prefs.textLibrary=[...new Set([...prefs.textLibrary,model.id])];prefs.textModel=model.id;source.body=formatPreference('models',prefs);const original=source.body;
 assert.equal(readPreference('models',notes).customModels[0].contextTokens,2048);assert.equal(source.body,original);assert.equal(source.version,1);assert.deepEqual(source.history,[]);
});

test('custom D1 declarations register only in the decision library and preserve old settings',()=>{
 const notes=structuredClone(initialPreferenceNotes),old=notes.find(n=>n.id==='settings-models'),legacy=readPreference('models',notes);delete legacy.customDecisionModels;old.body=legacyPreference('models',legacy);const before=old.body;assert.deepEqual(readPreference('models',notes).customDecisionModels,[]);assert.equal(old.body,before);
 const model=customDecision(),updated=updatePreference('models',notes,m=>({...m,customDecisionModels:[model],decisionLibrary:[model.id],decisionModel:model.id}));
 assert.equal(readPreference('models',updated).decisionModel,model.id);assert.deepEqual(readPreference('models',updated).customDecisionModels,[model]);assert.deepEqual(updated.find(n=>n.id===old.id).history,[before]);
 for(const change of [m=>m.textLibrary.push(model.id),m=>m.customDecisionModels[0].ready=true,m=>m.customDecisionModels[0].files[0].url='https://example.com',m=>m.customModels.push(model)]){const invalid=structuredClone(readPreference('models',updated));change(invalid);assert.throws(()=>parsePreference('models',formatPreference('models',invalid)));}
});

test('custom Whisper declarations register in Speech library and retain history without readiness',()=>{
 const notes=structuredClone(initialPreferenceNotes),old=notes.find(n=>n.id==='settings-models'),legacy=readPreference('models',notes);delete legacy.customSpeechModels;old.body=legacyPreference('models',legacy);const before=old.body;assert.deepEqual(readPreference('models',notes).customSpeechModels,[]);assert.equal(old.body,before);
 const model=customSpeech(),updated=updatePreference('models',notes,m=>({...m,customSpeechModels:[model],transcriptionLibrary:[model.id],transcriptionModel:model.id}));assert.equal(readPreference('models',updated).transcriptionModel,model.id);assert.deepEqual(readPreference('models',updated).customSpeechModels,[model]);assert.deepEqual(updated.find(n=>n.id===old.id).history,[before]);
 for(const change of [m=>m.textLibrary.push(model.id),m=>m.customSpeechModels[0].ready=true,m=>m.customSpeechModels[0].files[0].url='https://example.com',m=>m.customSpeechModels[0].engine='custom.js']){const bad=structuredClone(readPreference('models',updated));change(bad);assert.throws(()=>parsePreference('models',formatPreference('models',bad)));}
});
test('custom Vision declarations register in the Vision library, preserve revision history, and never claim readiness',()=>{
 const notes=structuredClone(initialPreferenceNotes),source=notes.find(n=>n.id==='settings-models'),legacy=readPreference('models',notes);delete legacy.customVisionModels;source.body=legacyPreference('models',legacy);const before=source.body;
 assert.deepEqual(readPreference('models',notes).customVisionModels,[]);
 const model=customVision(),updated=updatePreference('models',notes,m=>({...m,customVisionModels:[model],visionLibrary:[model.id],visionModel:model.id}));
 assert.equal(readPreference('models',updated).visionModel,model.id);assert.deepEqual(readPreference('models',updated).customVisionModels,[model]);assert.deepEqual(updated.find(n=>n.id==='settings-models').history,[before]);
 for(const change of [m=>m.customVisionModels[0].ready=true,m=>m.customVisionModels[0].engine='untrusted',m=>m.customVisionModels[0].files[0].url='https://example.com',m=>m.customVisionModels[0].revision='main',m=>m.textLibrary.push(model.id)]){const bad=structuredClone(readPreference('models',updated));change(bad);assert.throws(()=>parsePreference('models',formatPreference('models',bad)));}
});

test('custom declarations survive backup without assets and model proposals cannot register them',async()=>{
 const model=custom();model.source={provider:'huggingface',repo:'publisher/model-name',revision:'b'.repeat(40),file:'model-q4.gguf',license:'apache-2.0'};const notes=updatePreference('models',structuredClone(initialPreferenceNotes),m=>({...m,customModels:[model],textLibrary:[...m.textLibrary,model.id]}));
 const view=notes.find(n=>n.id==='settings-models'),note=createNote({path:view.path,body:view.body});note.id=view.id;note.ui={managed:true};
 const state={notes:[note],settings:[],runs:[]},pack=await makeStateBackup(state),parsed=await parseStateBackup(JSON.stringify(pack));assert.deepEqual(parsed.notes,state.notes);assert.deepEqual(readPreference('models',notes).customModels[0].source,model.source);
 const plan=planStateRestore({notes:[],settings:[],runs:[]},parsed);assert.equal(plan.conflicts.length,0);assert.deepEqual(parsePreference('models',plan.writes.notes[0].revisions.at(-1).body).customModels,[model]);
 assert.deepEqual(pack.payload.excluded,['model-assets','runtime-assets','unsaved-drafts','unpersisted-attachments']);
 assert.throws(()=>settingsPatchResult(note,JSON.stringify({action:'patch',changes:{customModels:[]}})),/Invalid settings patch/);
 assert.throws(()=>settingsPatchResult(note,JSON.stringify({action:'patch',changes:{textLibrary:[model.id]}})),/Invalid settings patch/);
});

test('appearance adds local font selection without rewriting old records or accepting unverified declarations',()=>{
 const notes=structuredClone(initialPreferenceNotes),record=notes.find(n=>n.id==='settings-appearance'),legacy=readPreference('appearance',notes);delete legacy.fontFamily;delete legacy.fonts;record.body=legacyPreference('appearance',legacy);const before=record.body;
 const migrated=readPreference('appearance',notes);assert.equal(migrated.fontFamily,'system');assert.deepEqual(migrated.fonts,[]);assert.equal(record.body,before);
 const font={id:'font-'+'a'.repeat(64),label:'Local Sans',format:'woff2',bytes:4000,sha256:'a'.repeat(64)};
 const updated=updatePreference('appearance',notes,value=>({...value,fontFamily:font.id,fonts:[font]}));assert.equal(readPreference('appearance',updated).fontFamily,font.id);assert.deepEqual(updated.find(n=>n.id===record.id).history,[before]);
 for(const change of [value=>{value.fonts[0].sha256='b'.repeat(64);},value=>{value.fontFamily='https://example.com/font.woff2';},value=>{value.fonts[0].format='css';}]){const invalid=structuredClone(readPreference('appearance',updated));change(invalid);assert.throws(()=>parsePreference('appearance',formatPreference('appearance',invalid)),/Invalid local font registry/);}
});


test('corrupt settings fall back safely and restore defaults with a versioned history while preserving memory',()=>{
 const notes=structuredClone(initialPreferenceNotes);const appearance=notes.find(n=>n.id==='settings-appearance');appearance.body='not valid settings';
 const read=readPreferenceWithFallback('appearance',notes);assert.equal(read.valid,false);assert.equal(read.value.background,readPreference('appearance',initialPreferenceNotes).background);
 const customized=structuredClone(notes);const models=customized.find(n=>n.id==='settings-models');models.body=formatPreference('models',{...readPreference('models',customized),textModel:'lfm2.5-230m-q4_0',textLibrary:['lfm2.5-230m-q4_0']});models.version=4;models.history=['v1','v2','v3'];models.paths=['Settings/models.md','Settings/models.md','Settings/models.md'];
 const harness=customized.find(n=>n.id==='settings-harness');harness.body=formatPreference('harness',{...readPreference('harness',customized),activeProfileId:'conversation'});harness.version=2;harness.history=['old harness'];
 const unrelated={id:'user-note',path:'Projects/a.md',body:'keep me',version:2,history:['old'],paths:['Projects/a.md','Projects/a.md']};customized.push(unrelated);
 const before=structuredClone(customized),restored=restoreDefaultPreferences(customized),newModels=restored.find(n=>n.id==='settings-models'),newAppearance=restored.find(n=>n.id==='settings-appearance');
 assert.equal(newModels.version,5);assert.equal(newModels.history.at(-1),before.find(n=>n.id==='settings-models').body);assert.equal(newAppearance.history.at(-1),'not valid settings');
 assert.equal(readPreference('harness',restored).activeProfileId,'standard');assert.equal(restored.find(n=>n.id==='settings-harness').history.at(-1),before.find(n=>n.id==='settings-harness').body);
 assert.equal(readPreference('models',restored).textModel,readPreference('models',initialPreferenceNotes).textModel);assert.deepEqual(restored.find(n=>n.id==='user-note'),unrelated);
});

test('corrupt settings use the newest valid historical value and a user edit preserves the corrupt revision',()=>{
 const notes=structuredClone(initialPreferenceNotes),original=notes.find(n=>n.id==='settings-harness').body;
 const first=updatePreference('harness',notes,value=>({...value,replyStyle:'concise'}));
 const second=updatePreference('harness',first,value=>({...value,replyStyle:'detailed'}));
 const damaged=structuredClone(second),current=damaged.find(n=>n.id==='settings-harness');current.body='broken current revision';
 const recovered=readPreferenceWithFallback('harness',damaged);
 assert.equal(recovered.valid,false);assert.equal(recovered.value.replyStyle,'concise');
 const repaired=updatePreference('harness',damaged,value=>({...value,replyStyle:'balanced'})),saved=repaired.find(n=>n.id==='settings-harness');
 assert.equal(saved.version,current.version+1);assert.equal(saved.history.at(-1),'broken current revision');
 assert.equal(saved.paths.at(-1),'Settings/harness.md');assert.equal(readPreference('harness',repaired).replyStyle,'balanced');
 assert.equal(readPreferenceWithFallback('harness',repaired).valid,true);assert.equal(notes.find(n=>n.id==='settings-harness').body,original);assert.equal(notes.find(n=>n.id==='settings-harness').version,1);
});

test('targeted settings recovery restores one last-valid file and retains the broken body as history',()=>{
 const base=structuredClone(initialPreferenceNotes),appearance=updatePreference('appearance',base,value=>({...value,background:'sand'})),secondAppearance=updatePreference('appearance',appearance,value=>({...value,glass:'frosted'})),harness=updatePreference('harness',secondAppearance,value=>({...value,replyStyle:'concise'}));
 const damaged=structuredClone(harness),target=damaged.find(n=>n.id==='settings-appearance'),other=damaged.find(n=>n.id==='settings-harness');target.body='broken appearance';
 const recovered=recoverPreferenceRecord('appearance',damaged),fixed=recovered.find(n=>n.id==='settings-appearance');
 assert.equal(readPreference('appearance',recovered).background,'sand');assert.equal(fixed.version,target.version+1);assert.equal(fixed.history.at(-1),'broken appearance');
 assert.deepEqual(recovered.find(n=>n.id==='settings-harness'),other);assert.deepEqual(recovered.find(n=>n.id==='settings-models'),damaged.find(n=>n.id==='settings-models'));
 const noHistory=structuredClone(initialPreferenceNotes),connection=noHistory.find(n=>n.id==='settings-connection');connection.body='broken connection';
 const defaulted=recoverPreferenceRecord('connection',noHistory);assert.equal(readPreference('connection',defaulted).downloads,false);assert.equal(defaulted.find(n=>n.id==='settings-connection').history.at(-1),'broken connection');
 for(const mutate of [records=>{records.find(n=>n.id==='settings-models').path='Elsewhere/models.md';},records=>{records.find(n=>n.id==='settings-models').managed=false;}]){const invalid=structuredClone(initialPreferenceNotes);mutate(invalid);assert.throws(()=>recoverPreferenceRecord('models',invalid),/Settings record unavailable/);}
 const missing=structuredClone(initialPreferenceNotes).filter(n=>n.id!=='settings-models'),recreated=recoverPreferenceRecord('models',missing);
 assert.equal(readPreference('models',recreated).textModel,readPreference('models',initialPreferenceNotes).textModel);
 assert.equal(recreated.find(n=>n.id==='settings-models').managed,true);
 assert.throws(()=>recoverPreferenceRecord('models',[...missing,{id:'collision',path:'Settings/models.md',body:'user file',version:1,history:[]}]),/path conflict/i);
});

test('a newer settings schema stays untouched until explicit recovery, which preserves it in history',()=>{
 const base=structuredClone(initialPreferenceNotes),edited=updatePreference('appearance',base,value=>({...value,background:'sand'})),records=structuredClone(edited),target=records.find(note=>note.id==='settings-appearance'),other=records.find(note=>note.id==='settings-harness');
 target.body=target.body.replace('"schemaVersion": 1','"schemaVersion": 2');const futureBody=target.body,before=structuredClone(records),read=readPreferenceWithFallback('appearance',records);
 assert.equal(read.valid,false);assert.equal(read.unsupportedSchema,true);assert.equal(read.value.background,'paper');
 assert.throws(()=>readPreference('appearance',records),/newer format/i);assert.throws(()=>updatePreference('appearance',records,value=>({...value,background:'sage'})),/newer format/i);assert.deepEqual(records,before);
 const recovered=recoverPreferenceRecord('appearance',records),saved=recovered.find(note=>note.id===target.id);
 assert.equal(readPreference('appearance',recovered).background,'paper');assert.equal(saved.version,target.version+1);assert.equal(saved.history.at(-1),futureBody);assert.deepEqual(recovered.find(note=>note.id===other.id),other);
});

test('restore all defaults refuses missing or tampered managed records without changing the input',()=>{
 for(const mutate of [records=>records.splice(records.findIndex(n=>n.id==='settings-models'),1),records=>{records.find(n=>n.id==='settings-models').path='Elsewhere/models.md';},records=>{records.find(n=>n.id==='settings-models').managed=false;}]){
  const records=structuredClone(initialPreferenceNotes);mutate(records);const before=structuredClone(records);assert.throws(()=>restoreDefaultPreferences(records),/Settings record unavailable/);assert.deepEqual(records,before);
 }
});
