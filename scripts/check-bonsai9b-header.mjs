// Read only the pinned GGUF metadata and runtime bundle. This is not a load test.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {inspectGGUF} from '../dist/gguf-inspect.js';
import {eligibleTextEngine} from '../dist/local-engines.js';

const manifest=JSON.parse(await readFile(new URL('../dist/model-manifest.json',import.meta.url),'utf8'));
const model=manifest.models.find(item=>item.id==='9B');
if(!model)throw Error('Pinned 9B model missing');

async function readExactRange(url,expectedTotal,length){
 const response=await fetch(url,{headers:{Range:`bytes=0-${length-1}`},signal:AbortSignal.timeout(30000)});
 const expected=`bytes 0-${length-1}/${expectedTotal}`;
 if(response.status!==206||response.headers.get('content-range')!==expected||!response.body){await response.body?.cancel();throw Error('Pinned range response mismatch');}
 const reader=response.body.getReader(),parts=[];let size=0;
 try{
  for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>length)throw Error('Range response exceeded bound');parts.push(value);}
  if(size!==length)throw Error('Pinned range length mismatch');
 }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}return bytes;
}

const headerLength=Math.min(model.file.bytes,16*1024*1024);
const header=await readExactRange(model.file.url,model.file.bytes,headerLength);
const file={size:model.file.bytes,slice(start,end){if(start!==0||end!==headerLength)throw Error('Unexpected GGUF slice');return {arrayBuffer:async()=>header.buffer};}};
const info=await inspectGGUF(file);
const engine=eligibleTextEngine(info)?.id??null;
if(engine!=='webml-qwen35')throw Error('Pinned 9B header is not eligible for the WebML adapter');

const runtime=manifest.runtime.file;
const runtimeBytes=await readExactRange(runtime.url,runtime.bytes,runtime.bytes);
const runtimeHash=createHash('sha256').update(runtimeBytes).digest('hex');
if(runtimeHash!==runtime.sha256)throw Error('Pinned runtime SHA-256 mismatch');

console.log(JSON.stringify({modelRevision:model.revision,rangeBytes:header.length,modelBytes:model.file.bytes,architecture:info.architecture,contextLength:info.contextLength,tokenizer:info.tokenizer,chatTemplate:info.chatTemplate,tokenCount:info.tokenCount,tensorCount:info.tensorCount,tensorTypes:info.tensorTypes,tensorExtentsChecked:info.tensorExtentsChecked,dataOffset:info.dataOffset,eligibleEngine:engine,runtimeRevision:manifest.runtime.revision,runtimeSha256:runtimeHash,executionVerified:false},null,2));
