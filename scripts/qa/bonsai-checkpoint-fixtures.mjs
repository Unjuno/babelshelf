// QA-only bounded rows from a fully hash-verified local 9B checkpoint.
// No model loader, downloads, activation/sign reconstruction or inference.
import {openAsBlob,createReadStream} from 'node:fs';
import {readFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {inspectGGUF} from '../../dist/gguf-inspect.js';

export async function checkpointFixtures(filePath){
 const manifest=JSON.parse(await readFile(new URL('../../dist/model-manifest.json',import.meta.url),'utf8')),model=manifest.models.find(m=>m.id==='9B');
 const before=await stat(filePath),blob=await openAsBlob(filePath);
 if(blob.size!==model.file.bytes||model.file.sha256!=='3561df7ac7d26a71ffa991ac2db740b10841c3a350aa2676ccd3ff5d428b4e8b')throw Error('Requires inspected pinned 9B checkpoint');
 const hash=createHash('sha256');for await(const part of createReadStream(filePath,{highWaterMark:1024*1024}))hash.update(part);
 const sha256=hash.digest('hex');if(sha256!==model.file.sha256)throw Error('Checkpoint SHA256 mismatch');
 const inspection=await inspectGGUF(blob),view=new DataView(await blob.slice(0,16*1024*1024).arrayBuffer());let at=8;
 const u32=()=>{const n=view.getUint32(at,true);at+=4;return n;},u64=()=>{const n=Number(view.getBigUint64(at,true));at+=8;return n;},decoder=new TextDecoder('utf-8',{fatal:true});
 const text=(keep=false)=>{const n=u64(),start=at;at+=n;return keep?decoder.decode(new Uint8Array(view.buffer,start,n)):undefined;};
 const widths={0:1,1:1,2:2,3:2,4:4,5:4,6:4,7:1,10:8,11:8,12:8};
 const skip=type=>{if(type===8){text();return;}if(type===9){const child=u32(),n=u64();if(child===8)for(let i=0;i<n;i++)text();else at+=widths[child]*n;return;}at+=widths[type];};
 const count=u64(),metadata=u64();for(let i=0;i<metadata;i++){text();skip(u32());}
 const selected=new Set(['token_embd.weight','output.weight','blk.0.attn_qkv.weight']),tensors=[];
 for(let i=0;i<count;i++){const name=text(true),rank=u32(),shape=Array.from({length:rank},()=>u64()),type=u32(),offset=u64();if(selected.has(name)){if(type!==143||rank!==2||shape[0]!==4096||shape[1]<256)throw Error('Checkpoint fixture shape changed');tensors.push({name,shape,type,start:inspection.dataOffset+offset});}}
 if(tensors.length!==selected.size)throw Error('Missing checkpoint fixture tensor');
 const fixtures=[];
 for(const tensor of tensors)for(const rowStart of [0,Math.floor((tensor.shape[1]/2)/256)*256,tensor.shape[1]-256]){
  const K=4096,N=256,start=tensor.start+rowStart*K/128*28,bytes=N*K/128*28,packed=new Uint8Array(await blob.slice(start,start+bytes).arrayBuffer());
  if(packed.length!==bytes)throw Error('Incomplete checkpoint rows');
  const values=new Int8Array(N*K),scales=new Uint16Array(N*K/128),raw=new DataView(packed.buffer);
  for(let block=0;block<scales.length;block++){
   const base=block*28;scales[block]=raw.getUint16(base+26,true);
   // Independent scalar base-three digit extraction; no runtime lookup tables.
   for(const [origin,lanes,digits,offset]of [[0,16,5,0],[80,8,5,16],[120,2,4,24]])for(let lane=0;lane<lanes;lane++)for(let digit=0;digit<digits;digit++)values[block*128+origin+lane+digit*lanes]=Math.floor(packed[base+offset+lane]*3**(digit+1)/256)%3-1;
  }
  fixtures.push({packed,values,scales,group:128,source:{tensor:tensor.name,shape:tensor.shape,rowStart,rows:N,byteStart:start,bytes,sha256:createHash('sha256').update(packed).digest('hex')}});
 }
 const after=await stat(filePath);if(before.size!==after.size||before.mtimeMs!==after.mtimeMs)throw Error('Checkpoint changed during inspection');
 return {identity:{id:model.id,revision:model.revision,quantization:model.format,sha256,bytes:blob.size},fixtures};
}
