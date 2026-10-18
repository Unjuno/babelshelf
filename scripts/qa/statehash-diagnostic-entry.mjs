export {stateHash} from '../../design/prototype/src/backup-state.ts';
export {visitJsonChunks} from '../../design/prototype/src/json-chunks.ts';
export {visitUtf8Chunks} from '../../design/prototype/src/utf8-text.ts';
export {SHA256} from '../../dist/sha256.js';

// Diagnostic copy of the canonical optional-field encoder, used only to
// separate stages; stateHash above is the actual product implementation.
export function encode(value){const undefinedPaths=[];
 const walk=(v,path)=>{if(v===undefined){undefinedPaths.push(path);return null;}if(Array.isArray(v))return v.map((x,i)=>walk(x,[...path,String(i)]));if(v&&typeof v==='object'){const out=Object.create(null);for(const [key,item] of Object.entries(v))out[key]=walk(item,[...path,key]);return out;}return v;};
 return {data:walk(value,[]),undefinedPaths};
}
