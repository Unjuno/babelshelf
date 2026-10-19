import {settings} from './app-settings.ts';
import type {Preferences} from './preference-records.ts';

export type ModelSetId='text-compact'|'text-expanded'|'text-speech'|'text-image'|'local-text-media'|'local-full';
export type ModelSet={id:ModelSetId;label:string;detail:string;models:{textModel:string;decisionModel:string;transcriptionModel:string;ocrModel:string}};

// These are selection presets over connected local adapters, not downloadable
// bundles, capability declarations, executable plans, or device-fit guarantees.
export const modelSets:readonly ModelSet[]=Object.freeze([
 {id:'text-compact',label:'Compact text',detail:'LFM2.5 230M · text only',models:{textModel:'lfm25-230m-qad-q4-0',decisionModel:'',transcriptionModel:'',ocrModel:''}},
 {id:'text-expanded',label:'Expanded text',detail:'LFM2.5 350M · text only',models:{textModel:'lfm25-350m-qad-q4-0',decisionModel:'',transcriptionModel:'',ocrModel:''}},
 {id:'text-speech',label:'Text + speech',detail:'Bonsai 2 · 4B · Whisper tiny',models:{textModel:'4B',decisionModel:'',transcriptionModel:'whisper-tiny',ocrModel:''}},
 {id:'text-image',label:'Text + image',detail:'Bonsai 2 · 4B · Tesseract 7',models:{textModel:'4B',decisionModel:'',transcriptionModel:'',ocrModel:'tesseract-7'}},
 {id:'local-text-media',label:'Text + media',detail:'Bonsai 2 · 4B · Whisper tiny · Tesseract 7',models:{textModel:'4B',decisionModel:'',transcriptionModel:'whisper-tiny',ocrModel:'tesseract-7'}},
 {id:'local-full',label:'Local pipeline',detail:'Bonsai 2 · 4B · Open d1 · Omni 600M · Whisper tiny · Tesseract 7',models:{textModel:'4B',decisionModel:'d1-omni-600M',transcriptionModel:'whisper-tiny',ocrModel:'tesseract-7'}},
]);

const connected=(set:ModelSet)=>{
 const roles=[['textModel','text'],['decisionModel','decision'],['transcriptionModel','transcription'],['ocrModel','ocr']] as const;
 for(const [selection,role] of roles){const id=set.models[selection];if(id&&!settings.models[role].some(model=>model.value===id))throw Error('Model set contains an unsupported model');}
};
for(const set of modelSets)connected(set);

export function matchingModelSet(value:Preferences['models']):ModelSet|undefined{
 return modelSets.find(set=>Object.entries(set.models).every(([key,id])=>value[key as keyof typeof set.models]===id));
}

export function applyModelSet(value:Preferences['models'],id:string):Preferences['models']{
 const set=modelSets.find(candidate=>candidate.id===id);if(!set)throw Error('Unknown model set');connected(set);
 return {...value,...set.models,
  textLibrary:set.models.textModel?[...new Set([...value.textLibrary,set.models.textModel])]:value.textLibrary,
  decisionLibrary:set.models.decisionModel?[...new Set([...value.decisionLibrary,set.models.decisionModel])]:value.decisionLibrary,
  transcriptionLibrary:set.models.transcriptionModel?[...new Set([...value.transcriptionLibrary,set.models.transcriptionModel])]:value.transcriptionLibrary,
  ocrLibrary:set.models.ocrModel?[...new Set([...value.ocrLibrary,set.models.ocrModel])]:value.ocrLibrary,
 };
}
