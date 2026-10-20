// Full pinned local-file audit with bounded streaming memory. Does not load a
// model, allocate GPU weights or infer language quality from finite scalars.
import {openAsBlob,createReadStream} from 'node:fs';
import {readFile,writeFile,stat} from 'node:fs/promises';
import os from 'node:os';
import {inspectGGUF} from '../../dist/gguf-inspect.js';
import {createStreamingSHA256,streamingSHA256Backend} from '../../dist/streaming-sha256.js';
await import('../../design/prototype/src/fast-hash.ts');
const [id,filePath,output]=process.argv.slice(2);
if(!id||!filePath||!output)throw Error('Use MODEL_ID PINNED_LOCAL_GGUF OUTPUT.json');
const manifest=JSON.parse(await readFile(new URL('../../dist/model-manifest.json',import.meta.url),'utf8')),model=manifest.models.find(m=>m.id===id);
if(!model)throw Error('Unknown pinned model');
const before=await stat(filePath),blob=await openAsBlob(filePath);
if(blob.size!==model.file.bytes)throw Error('Pinned size mismatch');
const inspection=await inspectGGUF(blob),header=new DataView(await blob.slice(0,Math.min(blob.size,16*1024*1024)).arrayBuffer());let at=8;
const u32=()=>{const n=header.getUint32(at,true);at+=4;return n;},u64=()=>{const n=Number(header.getBigUint64(at,true));at+=8;return n;},decoder=new TextDecoder('utf-8',{fatal:true});
function text(keep=false){const size=u64(),start=at;at+=size;return keep?decoder.decode(new Uint8Array(header.buffer,start,size)):undefined;}
const widths={0:1,1:1,2:2,3:2,4:4,5:4,6:4,7:1,10:8,11:8,12:8};
function skip(type){if(type===8){text();return;}if(type===9){const child=u32(),count=u64();if(child===8)for(let i=0;i<count;i++)text();else at+=widths[child]*count;return;}at+=widths[type];}
const tensorCount=u64(),metadataCount=u64();for(let i=0;i<metadataCount;i++){text();skip(u32());}
const tensors=[];
for(let i=0;i<tensorCount;i++){
 const name=text(true),rank=u32(),shape=Array.from({length:rank},()=>u64()),type=u32(),offset=u64(),elements=shape.reduce((a,b)=>a*b,1),group=type===0?1:type===42?64:128,step=type===0?4:type===143?28:type===142?34:type===42?18:0;
 if(!step)throw Error('Unsupported audit tensor type');
 const start=inspection.dataOffset+offset,size=elements/group*step;
 tensors.push({name,type,elements,start,size,step,first:start+(type===143?26:0),expectedScalars:elements/group,scalars:0,nonFinite:0,zero:0,negative:0,min:null,max:null});
}
tensors.sort((a,b)=>a.start-b.start);
const hash=await createStreamingSHA256(),started=performance.now();let offset=0,firstTensor=0;
for await(const chunk of createReadStream(filePath,{highWaterMark:8*1024*1024})){
 hash.update(chunk);const end=offset+chunk.length,view=new DataView(chunk.buffer,chunk.byteOffset,chunk.byteLength);
 while(firstTensor<tensors.length&&tensors[firstTensor].start+tensors[firstTensor].size<=offset)firstTensor++;
 for(let t=firstTensor;t<tensors.length&&tensors[t].start<end;t++){
  const item=tensors[t],width=item.type===0?4:2,limit=Math.min(end,item.start+item.size),index=Math.max(0,Math.ceil((offset-item.first)/item.step));
  for(let position=item.first+index*item.step;position+width<=limit;position+=item.step){
   let value;
   if(item.type===0)value=view.getFloat32(position-offset,true);
   else{const bits=view.getUint16(position-offset,true),exponent=(bits>>10)&31,mantissa=bits&1023,sign=bits&32768?-1:1;value=exponent===31?mantissa?NaN:sign*Infinity:sign*(exponent?2**(exponent-15)*(1+mantissa/1024):2**-14*mantissa/1024);}
   item.scalars++;if(!Number.isFinite(value)){item.nonFinite++;continue;}if(value===0)item.zero++;if(value<0)item.negative++;item.min=item.min===null?value:Math.min(item.min,value);item.max=item.max===null?value:Math.max(item.max,value);
  }
 }
 offset=end;
}
const sha256=hash.hex(),after=await stat(filePath),stable=before.size===after.size&&before.mtimeMs===after.mtimeMs;
const result={schema:1,at:new Date().toISOString(),scope:'Full GGUF identity, F32 tensor scalars and quantization FP16 scales only; no GPU or generation correctness claim',os:{platform:os.platform(),release:os.release(),arch:os.arch()},node:process.version,browser:null,backend:'CPU',model:id,revision:model.revision,quantization:model.format,bytes:offset,sha256,expectedSha256:model.file.sha256,stable,hashBackend:streamingSHA256Backend(),elapsedMs:performance.now()-started,inputTokens:null,outputTokens:null,inspection,tensors,nonFinite:tensors.reduce((n,t)=>n+t.nonFinite,0)};
result.passed=stable&&offset===model.file.bytes&&sha256===model.file.sha256&&result.nonFinite===0&&tensors.every(t=>t.scalars===t.expectedScalars);
await writeFile(output,JSON.stringify(result,null,2));console.log(JSON.stringify({model:id,passed:result.passed,sha256,scalars:tensors.reduce((n,t)=>n+t.scalars,0),nonFinite:result.nonFinite,incomplete:tensors.filter(t=>t.scalars!==t.expectedScalars).map(t=>t.name),elapsedMs:result.elapsedMs}));process.exitCode=result.passed?0:1;
