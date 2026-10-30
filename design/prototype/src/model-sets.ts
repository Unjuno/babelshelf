import {localAdapters} from './local-capabilities.ts';
import {initialPreparationPlan} from './initial-preparation.ts';
import type {Preferences,ModelSetSelection,UserModelSet} from './preference-records.ts';

export type ModelSetId=string;
export type ModelSet=UserModelSet;
export type ModelSetGroup='Text models'|'Input sets'|'Combined sets'|'Saved by you';

const textModelSetIds=new Set(['lfm3-1.7b-qad-q4-0','lfm3-1.7b-q8-0','bonsai-2b-text','bonsai-4b-text','bonsai-9b-text']);
const inputSupportSetIds=new Set(['text-speech','text-image','text-vision']);
const combinedSetIds=new Set(['local-text-media','text-image-audio','text-image-audio-q8','local-full']);

/** Presentation-only grouping; persisted custom-set records keep their existing schema. */
export function modelSetGroup(id:string):ModelSetGroup{
 if(textModelSetIds.has(id))return 'Text models';
 if(inputSupportSetIds.has(id))return 'Input sets';
 if(combinedSetIds.has(id))return 'Combined sets';
 if(/^user-[a-z0-9-]+$/.test(id))return 'Saved by you';
 throw Error('Unknown model set');
}

// These are selection presets over connected local adapters, not downloadable
// bundles, capability declarations, executable plans, or device-fit guarantees.
export const modelSets:readonly ModelSet[]=Object.freeze([
 {id:'lfm3-1.7b-qad-q4-0',label:'LFM3 · 1.7B · QAD Q4_0',detail:'Text · WebGPU first',models:{textModel:'lfm3-1.7b-qad-q4-0',decisionModel:'',transcriptionModel:'',ocrModel:'',visionModel:''}},
 {id:'lfm3-1.7b-q8-0',label:'LFM3 · 1.7B · Q8_0',detail:'Text · WebGPU first · 1.85 GB',models:{textModel:'lfm3-1.7b-q8-0',decisionModel:'',transcriptionModel:'',ocrModel:'',visionModel:''}},
 {id:'bonsai-2b-text',label:'Bonsai 2 · 2B',detail:'Text only',models:{textModel:'2B',decisionModel:'',transcriptionModel:'',ocrModel:'',visionModel:''}},
 {id:'bonsai-4b-text',label:'Bonsai 2 · 4B',detail:'Text only',models:{textModel:'4B',decisionModel:'',transcriptionModel:'',ocrModel:'',visionModel:''}},
 {id:'bonsai-9b-text',label:'Bonsai 2 · 9B',detail:'Text only · PC prose unstable',models:{textModel:'9B',decisionModel:'',transcriptionModel:'',ocrModel:'',visionModel:''}},
 {id:'text-speech',label:'Text + speech',detail:'LFM3 QAD Q4_0 · Whisper tiny',models:{textModel:'lfm3-1.7b-qad-q4-0',decisionModel:'',transcriptionModel:'whisper-tiny',ocrModel:'',visionModel:''}},
 {id:'text-image',label:'Text + OCR',detail:'LFM3 QAD Q4_0 · Tesseract 7 · image text only',models:{textModel:'lfm3-1.7b-qad-q4-0',decisionModel:'',transcriptionModel:'',ocrModel:'tesseract-7',visionModel:''}},
 {id:'text-vision',label:'Text + vision',detail:'LFM3 QAD Q4_0 · LFM2.5-VL 450M',models:{textModel:'lfm3-1.7b-qad-q4-0',decisionModel:'',transcriptionModel:'',ocrModel:'',visionModel:'lfm25-vl-450m-q4f16'}},
 {id:'local-text-media',label:'Text + capture',detail:'LFM3 QAD Q4_0 · Whisper tiny · Tesseract 7 · no image understanding',models:{textModel:'lfm3-1.7b-qad-q4-0',decisionModel:'',transcriptionModel:'whisper-tiny',ocrModel:'tesseract-7',visionModel:''}},
 {id:'text-image-audio',label:'Text + image + audio',detail:'LFM3 QAD Q4_0 · Whisper tiny · Tesseract 7 · LFM2.5-VL 450M · sampled video frames',models:{textModel:'lfm3-1.7b-qad-q4-0',decisionModel:'',transcriptionModel:'whisper-tiny',ocrModel:'tesseract-7',visionModel:'lfm25-vl-450m-q4f16'}},
 {id:'text-image-audio-q8',label:'Text + image + audio · Q8',detail:'LFM3 Q8_0 · Whisper tiny · Tesseract 7 · LFM2.5-VL 450M · device fit not checked',models:{textModel:'lfm3-1.7b-q8-0',decisionModel:'',transcriptionModel:'whisper-tiny',ocrModel:'tesseract-7',visionModel:'lfm25-vl-450m-q4f16'}},
 {id:'local-full',label:'Text + voice + OCR + decision',detail:'LFM3 text · Whisper tiny · Tesseract 7 · d1 text decisions only · no image understanding',models:{textModel:'lfm3-1.7b-qad-q4-0',decisionModel:'d1-omni-600M',transcriptionModel:'whisper-tiny',ocrModel:'tesseract-7',visionModel:''}},
]);

const connected=(set:ModelSet,value?:Preferences['models'])=>{
 const roles=[['textModel','text','text.generate'],['decisionModel','decision','decision.classify'],['transcriptionModel','transcription','audio.transcribe'],['ocrModel','ocr','image.ocr'],['visionModel','vision','image.describe']] as const;
 for(const [selection,role,capability] of roles){const id=set.models[selection];if(!id)continue;const adapter=localAdapters.some(item=>item.models.includes(id)&&item.capabilities.includes(capability));const custom=role==='text'?value?.customModels.some(model=>model.id===id&&model.role==='text'&&['webml-qwen35','wllama-lfm2','wllama-lfm3','wllama-qwen3'].includes(model.engine)):role==='decision'?value?.customDecisionModels.some(model=>model.id===id&&model.role==='decision'&&model.engine==='onnx-d1-text'):role==='transcription'?value?.customSpeechModels.some(model=>model.id===id&&model.role==='speech'&&model.engine==='transformers-whisper-onnx'):role==='vision'?value?.customVisionModels.some(model=>model.id===id&&model.role==='vision'&&model.engine==='transformers-lfm2-vl-onnx'):false;if(!adapter&&!custom)throw Error('Model set contains a model without a connected role adapter');}
};
for(const set of modelSets)connected(set);

export function modelSetsFor(value:Preferences['models']):readonly ModelSet[]{return [...value.customSets,...modelSets];}

export function createUserModelSet(value:Preferences['models'],label:string,detail:string):UserModelSet{
 const name=label.trim(),description=detail.trim();
 if(!name||name.length>48||/[\u0000-\u001f\u007f]/.test(name))throw Error('Set name must be 1–48 characters');
 if(!description||description.length>120||/[\u0000-\u001f\u007f]/.test(description))throw Error('Set detail must be 1–120 characters');
 const models:ModelSetSelection={textModel:value.textModel,decisionModel:value.decisionModel,transcriptionModel:value.transcriptionModel,ocrModel:value.ocrModel,visionModel:value.visionModel};
 if(!models.textModel)throw Error('Choose a Text model first');
 const idPart=name.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,36)||'model';
 const used=new Set([...modelSets.map(set=>set.id),...value.customSets.map(set=>set.id)]);
 let id='user-'+idPart,suffix=2;
 while(used.has(id)){id='user-'+idPart+'-'+suffix++;if(suffix>10000)throw Error('Too many model sets');}
 const set={id,label:name,detail:description,models};connected(set,value);
 return set;
}

export function matchingModelSet(value:Preferences['models']):ModelSet|undefined{
 return modelSetsFor(value).find(set=>Object.entries(set.models).every(([key,id])=>value[key as keyof ModelSetSelection]===id));
}

export function applyModelSet(value:Preferences['models'],id:string):Preferences['models']{
 const set=modelSetsFor(value).find(candidate=>candidate.id===id);if(!set)throw Error('Unknown model set');connected(set,value);
 return {...value,...set.models,
  textLibrary:set.models.textModel?[...new Set([...value.textLibrary,set.models.textModel])]:value.textLibrary,
  decisionLibrary:set.models.decisionModel?[...new Set([...value.decisionLibrary,set.models.decisionModel])]:value.decisionLibrary,
  transcriptionLibrary:set.models.transcriptionModel?[...new Set([...value.transcriptionLibrary,set.models.transcriptionModel])]:value.transcriptionLibrary,
  ocrLibrary:set.models.ocrModel?[...new Set([...value.ocrLibrary,set.models.ocrModel])]:value.ocrLibrary,
  visionLibrary:set.models.visionModel?[...new Set([...value.visionLibrary,set.models.visionModel])]:value.visionLibrary,
 };
}

// Cold acquisition total for the selected roles, before any existing local
// cache is considered. This is a manifest byte count, not a device-fit claim.
export function modelSetAssetBytes(value:Preferences['models'],id:string):number{
 const selected=applyModelSet(value,id);
 return initialPreparationPlan(selected,{text:false,speech:false,ocr:false,decision:false,vision:false}).bytes;
}
