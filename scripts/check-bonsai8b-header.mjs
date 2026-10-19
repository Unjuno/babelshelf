// Bounded inspection of the older Bonsai 8B, not a model download or run.
import {inspectGGUF} from '../dist/gguf-inspect.js';
import {eligibleTextEngine} from '../dist/local-engines.js';

const revision='c2aefbeb4b24469cd11579c3384b990404c17a30';
const expectedBytes=2182184672;
const headerBytes=16*1024*1024;
const url=`https://huggingface.co/prism-ml/Ternary-Bonsai-8B-gguf/resolve/${revision}/Ternary-Bonsai-8B-Q2_0.gguf`;
const response=await fetch(url,{headers:{Range:`bytes=0-${headerBytes-1}`},signal:AbortSignal.timeout(60000)});
const expectedRange=`bytes 0-${headerBytes-1}/${expectedBytes}`;
if(response.status!==206||response.headers.get('content-range')!==expectedRange||!response.body){await response.body?.cancel();throw Error('Pinned 8B range response mismatch');}
const bytes=new Uint8Array(await response.arrayBuffer());
if(bytes.length!==headerBytes)throw Error('Pinned 8B header length mismatch');
const file={size:expectedBytes,slice(start,end){if(start!==0||end>headerBytes)throw Error('Unexpected GGUF header read');return {arrayBuffer:async()=>bytes.slice(start,end).buffer};}};
const info=await inspectGGUF(file);
const engine=eligibleTextEngine(info)?.id??null;
if(info.architecture!=='qwen3'||!info.tensorTypes.includes(42)||info.tensorExtentsChecked!==false||engine!==null)throw Error('8B compatibility boundary changed; review the engine before proceeding');
console.log(JSON.stringify({revision,modelBytes:expectedBytes,headerBytes,architecture:info.architecture,tokenizer:info.tokenizer,tensorTypes:info.tensorTypes,tensorExtentsChecked:info.tensorExtentsChecked,eligibleEngine:engine,fullFileVerified:false,inferenceVerified:false},null,2));
