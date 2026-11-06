// Container inspection only. No model strings are executed and no tensor payload is interpreted.
const HEADER_LIMIT=16*1024*1024;
const widths={0:1,1:1,2:2,3:2,4:4,5:4,6:4,7:1,10:8,11:8,12:8};
const retained=new Set(['general.architecture','general.name','general.alignment','tokenizer.ggml.model','tokenizer.chat_template']);
export async function inspectGGUF(file,{signal}={}){
 const fail=message=>{throw Error('GGUF · '+message);};
 if(!file||!Number.isSafeInteger(file.size)||file.size<24||typeof file.slice!=='function')fail('Invalid file');
 signal?.throwIfAborted();
 const bytes=new Uint8Array(await file.slice(0,Math.min(file.size,HEADER_LIMIT)).arrayBuffer());
 signal?.throwIfAborted();
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),decoder=new TextDecoder('utf-8',{fatal:true});let at=0;
 function take(size){if(!Number.isSafeInteger(size)||size<0||at+size>bytes.length)fail('Truncated or oversized metadata');const start=at;at+=size;return start;}
 function u32(){return view.getUint32(take(4),true);}
 function u64(){const value=view.getBigUint64(take(8),true);if(value>BigInt(Number.MAX_SAFE_INTEGER))fail('Integer exceeds safe range');return Number(value);}
 function string(keep=false){const length=u64();if(length>HEADER_LIMIT)fail('String exceeds metadata budget');const start=take(length);if(!keep)return undefined;try{return decoder.decode(bytes.subarray(start,start+length));}catch{fail('Invalid UTF-8');}}
 function scalar(type){const pos=take(widths[type]??fail('Unsupported metadata type'));let value;
  switch(type){case 0:value=view.getUint8(pos);break;case 1:value=view.getInt8(pos);break;case 2:value=view.getUint16(pos,true);break;case 3:value=view.getInt16(pos,true);break;case 4:value=view.getUint32(pos,true);break;case 5:value=view.getInt32(pos,true);break;case 6:value=view.getFloat32(pos,true);break;case 7:value=view.getUint8(pos);if(value>1)fail('Invalid boolean');return !!value;case 10:case 11:{const n=type===10?view.getBigUint64(pos,true):view.getBigInt64(pos,true);if(n>BigInt(Number.MAX_SAFE_INTEGER)||n<BigInt(Number.MIN_SAFE_INTEGER))fail('Integer exceeds safe range');value=Number(n);break;}case 12:value=view.getFloat64(pos,true);break;}
  if(!Number.isFinite(value))fail('Invalid number');return value;
 }
 function value(type,keep){if(type===8)return string(keep);if(type!==9)return scalar(type);
  const elementType=u32(),count=u64();if(count>2000000||elementType===9)fail('Unsupported or oversized array');
  if(elementType===8){for(let i=0;i<count;i++){if(i%2048===0)signal?.throwIfAborted();string();}}
  else {const width=widths[elementType];if(!width)fail('Unsupported array type');take(count*width);}
  return {elementType,count};
 }
 if(view.getUint32(take(4),true)!==0x46554747)fail('Not a GGUF file');
 const version=u32();if(version!==3)fail('Unsupported version');
 const tensorCount=u64(),metadataCount=u64();if(tensorCount<1||tensorCount>20000||metadataCount>4096)fail('Invalid table counts');
 const metadata=new Map();
 for(let i=0;i<metadataCount;i++){
  signal?.throwIfAborted();const key=string(true);if(!key||key.length>256||metadata.has(key))fail('Invalid or duplicate metadata key');
  metadata.set(key,value(u32(),retained.has(key)||key.endsWith('.context_length')));
 }
 const types=new Set(),names=new Set(),offsets=[];
 for(let i=0;i<tensorCount;i++){
  signal?.throwIfAborted();const name=string(true);if(!name||name.length>512||names.has(name))fail('Invalid or duplicate tensor');names.add(name);
  const dimensions=u32();if(dimensions<1||dimensions>8)fail('Invalid tensor dimensions');let elements=1;
  for(let j=0;j<dimensions;j++){const n=u64();elements*=n;if(n<1||!Number.isSafeInteger(elements))fail('Invalid tensor shape');}
  const type=u32(),offset=u64();types.add(type);let size=null;
  if(type===0)size=elements*4;
  if(type===143){if(elements%128)fail('Invalid PTQ1_0 block shape');size=elements/128*28;}
  // Prism-private PQ2_0 (142): 128 two-bit values and one FP16 scale.
  if(type===142){if(elements%128)fail('Invalid PQ2_0 block shape');size=elements/128*34;}
  // Type 42 is the current official Q2_0 layout: 64 values in 18 bytes.
  // Older Prism files reused this type ID for 128 values in 34 bytes.
  // Checking extents and adjacent offsets must reject that legacy layout.
  if(type===42){if(elements%64)fail('Invalid Q2_0 block shape');size=elements/64*18;}
  if(type===2){if(elements%32)fail('Invalid Q4_0 block shape');size=elements/32*18;}
  if(type===8){if(elements%32)fail('Invalid Q8_0 block shape');size=elements/32*34;}
  if(type===14){if(elements%256)fail('Invalid Q6_K block shape');size=elements/256*210;}
  if(size!==null&&!Number.isSafeInteger(size))fail('Tensor size exceeds safe range');
  offsets.push({offset,size,type});
 }
 const alignment=metadata.get('general.alignment')??32;
 if(!Number.isInteger(alignment)||alignment<1||alignment>4096||(alignment&(alignment-1)))fail('Invalid alignment');
 const dataOffset=Math.ceil(at/alignment)*alignment;
 if(dataOffset>=file.size)fail('Tensor range outside file');
 for(const {offset,size,type} of offsets)if(offset%alignment!==0||offset>=file.size-dataOffset||size!==null&&size>file.size-dataOffset-offset)fail(type===42?'Q2_0 tensor exceeds file for official group-64 blocks':'Tensor range outside file');
 const ordered=offsets.slice().sort((a,b)=>a.offset-b.offset);
 for(let i=0;i+1<ordered.length;i++)if(ordered[i].size!==null&&ordered[i].offset+ordered[i].size>ordered[i+1].offset)fail(ordered[i].type===42?'Q2_0 tensor layout conflicts with official group-64 blocks':'Tensor ranges overlap');
 const architecture=metadata.get('general.architecture'),tokenArray=metadata.get('tokenizer.ggml.tokens');
 return {format:'GGUF',version,bytes:file.size,name:typeof metadata.get('general.name')==='string'?metadata.get('general.name'):'',architecture:typeof architecture==='string'?architecture:'',contextLength:metadata.get(architecture+'.context_length'),tokenizer:metadata.get('tokenizer.ggml.model'),chatTemplate:typeof metadata.get('tokenizer.chat_template')==='string'&&metadata.get('tokenizer.chat_template').trim().length>0,tokenCount:tokenArray?.elementType===8?tokenArray.count:0,tensorCount,tensorTypes:[...types].sort((a,b)=>a-b),tensorExtentsChecked:offsets.every(t=>t.size!==null),dataOffset};
}
