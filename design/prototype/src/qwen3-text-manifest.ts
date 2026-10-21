import runtime from '../runtime/wllama-count/manifest.json' with {type:'json'};
import type {CustomLocalModel} from './preference-records.ts';
export const customQwen3Models=(custom:readonly CustomLocalModel[]=[])=>custom.filter(m=>m.engine==='wllama-qwen3').map(m=>({id:m.id,name:m.label,revision:m.revision,engine:'wllama-qwen3-cpu',contextTokens:2048,runtime,file:{name:m.file.sha256+'.gguf',bytes:m.file.bytes,sha256:m.file.sha256},localModel:structuredClone(m)}));
export const getQwen3TextManifest=(id:string,custom:readonly CustomLocalModel[]=[])=>customQwen3Models(custom).find(m=>m.id===id);
export const describeQwen3Text=(custom:readonly CustomLocalModel[]=[])=>({contextTokens:2048,runtime,models:customQwen3Models(custom)});
