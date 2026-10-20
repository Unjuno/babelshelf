import tiny from './speech-manifest.json' with {type:'json'};
import base from './speech-base-manifest.json' with {type:'json'};
import type {CustomSpeechModel} from './preference-records.ts';

// One package identity is shared by preparation, execution and source records.
// A UI label alone cannot admit another architecture or a remote runtime.
export const speechModels=Object.freeze([tiny,base]);
export const getSpeechManifest=(id:string)=>speechModels.find(model=>model.id===id);
export const speechModelLabel=(id:string)=>id==='whisper-base'?'Whisper base':id==='whisper-tiny'?'Whisper tiny':id;
export function speechModelProvenance(id='whisper-tiny',customModels:readonly CustomSpeechModel[]=[]){
 const custom=customModels.find(model=>model.id===id);
 if(custom)return {id:custom.id,revision:custom.revision,runtime:tiny.runtime,dtype:'q8'};
 const model=getSpeechManifest(id);if(!model)throw Error('Speech runtime not connected');
 return {id:model.id,revision:model.revision,runtime:model.runtime,dtype:model.dtype};
}
export function validSpeechModelProvenance(value:{id:string;revision:string;runtime:string;dtype:string}|undefined){
 if(!value||Object.keys(value).sort().join(',')!=='dtype,id,revision,runtime')return false;
 const builtin=getSpeechManifest(value.id);
 if(builtin)return value.revision===builtin.revision&&value.dtype===builtin.dtype&&(value.runtime===builtin.runtime||value.id==='whisper-tiny'&&value.runtime==='@huggingface/transformers@3.8.1');
 return /^local-speech-[a-f0-9]{64}$/.test(value.id)&&value.revision==='sha256:'+value.id.slice('local-speech-'.length)&&[tiny.runtime,'@huggingface/transformers@3.8.1'].includes(value.runtime)&&value.dtype==='q8';
}
