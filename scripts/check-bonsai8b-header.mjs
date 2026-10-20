// Bounded inspection of all current Bonsai 1 8B packings. This verifies the
// pinned HTTP range and GGUF metadata, not tensor payloads or inference.
import {inspectGGUF} from '../dist/gguf-inspect.js';
import {eligibleTextEngine} from '../dist/local-engines.js';

const revision='c2aefbeb4b24469cd11579c3384b990404c17a30';
const repository='prism-ml/Ternary-Bonsai-8B-gguf';
const headerBytes=16*1024*1024;
// Sizes come from the exact-revision Hugging Face repository API. The
// unchanged legacy name cannot identify the newer group-64 packing.
const variants=[
 {name:'Ternary-Bonsai-8B-Q2_0.gguf',bytes:2182184672,type:42,packing:'legacy-group128'},
 {name:'Ternary-Bonsai-8B-Q2_0_g64.gguf',bytes:2310125920,type:42,packing:'official-group64'},
 {name:'Ternary-Bonsai-8B-PQ2_0.gguf',bytes:2182184672,type:142,packing:'prism-group128'},
];

const results=[];
for(const variant of variants){
 const url=`https://huggingface.co/${repository}/resolve/${revision}/${variant.name}`;
 const response=await fetch(url,{headers:{Range:`bytes=0-${headerBytes-1}`},signal:AbortSignal.timeout(60000)});
 const expectedRange=`bytes 0-${headerBytes-1}/${variant.bytes}`;
 if(response.status!==206||response.headers.get('content-range')!==expectedRange||!response.body){await response.body?.cancel();throw Error(`${variant.name}: pinned range response mismatch`);}
 const bytes=new Uint8Array(await response.arrayBuffer());
 if(bytes.length!==headerBytes)throw Error(`${variant.name}: header length mismatch`);
 const file={size:variant.bytes,slice(start,end){if(start!==0||end>headerBytes)throw Error('Unexpected GGUF header read');return {arrayBuffer:async()=>bytes.slice(start,end).buffer};}};
 let info;
 try{info=await inspectGGUF(file);}catch(error){
  if(variant.packing!=='legacy-group128'||!String(error).includes('Q2_0 tensor'))throw error;
  results.push({file:variant.name,packing:variant.packing,modelBytes:variant.bytes,inspectionError:String(error),eligibleBrowserEngine:null});
  continue;
 }
 const engine=eligibleTextEngine(info)?.id??null;
 if(info.architecture!=='qwen3'||info.tokenizer!=='gpt2'||!info.tensorTypes.includes(variant.type)||info.tensorExtentsChecked!==(variant.packing==='official-group64')||engine!==null)throw Error(`${variant.name}: compatibility boundary changed; review before offering an engine`);
 results.push({file:variant.name,packing:variant.packing,modelBytes:variant.bytes,architecture:info.architecture,tokenizer:info.tokenizer,tensorTypes:info.tensorTypes,tensorExtentsChecked:info.tensorExtentsChecked,eligibleBrowserEngine:engine});
}
console.log(JSON.stringify({repository,revision,headerBytes,results,fullFilesVerified:false,inferenceVerified:false},null,2));
