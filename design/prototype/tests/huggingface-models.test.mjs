import test from 'node:test';
import assert from 'node:assert/strict';
import {findHuggingFaceModels,downloadHuggingFaceModel,inspectHuggingFaceModel,expectedTextEngineForArchitecture} from '../src/huggingface-models.ts';
import {allowHuggingFaceRequest} from '../src/huggingface-network.ts';

const commit='a'.repeat(40),repo='owner/model';
const u32=n=>{const b=Buffer.alloc(4);b.writeUInt32LE(n);return b;},u64=n=>{const b=Buffer.alloc(8);b.writeBigUInt64LE(BigInt(n));return b;},str=s=>Buffer.concat([u64(Buffer.byteLength(s)),Buffer.from(s)]);
function modelBytes(type=143){
 const entries=[['general.architecture',8,str('qwen35')],['qwen35.context_length',4,u32(4096)],['tokenizer.ggml.model',8,str('gpt2')],['tokenizer.chat_template',8,str('{{ messages }}')],['tokenizer.ggml.tokens',9,Buffer.concat([u32(8),u64(1),str('a')])]];
 const header=Buffer.concat([Buffer.from('GGUF'),u32(3),u64(1),u64(entries.length),...entries.map(([k,t,v])=>Buffer.concat([str(k),u32(t),v])),str('weight'),u32(1),u64(128),u32(type),u64(0)]);
 return Buffer.concat([header,Buffer.alloc((32-header.length%32)%32),Buffer.alloc(512)]);
}
const metadata={id:repo,sha:commit,cardData:{license:'apache-2.0'},siblings:[{rfilename:'config.json',size:64},{rfilename:'model-q4.gguf',size:24},{rfilename:'model-00001-of-00002.gguf',size:24},{rfilename:'../escape.gguf',size:4},{rfilename:'too-large.gguf',size:8*1024**3+1}]};
function jsonResponse(value){return new Response(JSON.stringify(value),{status:200,headers:{'content-type':'application/json'}});}

test('Hugging Face repository architectures map to their actual local execution engines',()=>{
 assert.equal(expectedTextEngineForArchitecture('qwen35'),'webml-qwen35');assert.equal(expectedTextEngineForArchitecture('qwen3'),'wllama-qwen3');assert.equal(expectedTextEngineForArchitecture('lfm2'),'wllama-lfm2');assert.equal(expectedTextEngineForArchitecture('lfm3'),'wllama-lfm3');assert.equal(expectedTextEngineForArchitecture('gguf'),null);
});

test('Hugging Face discovery resolves architecture at the repository commit and returns only bounded safe GGUF files',async()=>{
 const calls=[],fetcher=async(url,options)=>{calls.push({url,options});return url.includes('/api/models/')?jsonResponse(metadata):jsonResponse({model_type:'qwen3_5'});};
 const result=await findHuggingFaceModels(repo,{fetcher});
 assert.deepEqual(result,{repo,revision:commit,license:'apache-2.0',architecture:'qwen35',files:[{path:'model-q4.gguf',bytes:24}]});
 assert.match(calls[1].url,new RegExp('/resolve/'+commit+'/config\\.json$'));
 for(const call of calls){assert.equal(call.options.credentials,'omit');assert.equal(call.options.referrerPolicy,'no-referrer');}
});

test('Hugging Face discovery refuses unknown engines and malformed or private repository IDs',async()=>{
 await assert.rejects(findHuggingFaceModels('../owner/model'),/public Hugging Face model ID/);
 await assert.rejects(findHuggingFaceModels('owner/model',{fetcher:async(url)=>url.includes('/api/models/')?jsonResponse(metadata):jsonResponse({model_type:'llama'})}),/No connected local engine/);
 assert.equal((await findHuggingFaceModels('owner/model',{fetcher:async(url)=>url.includes('/api/models/')?jsonResponse(metadata):jsonResponse({model_type:'qwen3'})})).architecture,'qwen3');
});

test('GGUF-only repositories without root config remain discoverable and require actual file compatibility',async()=>{
 const withoutConfig={...metadata,siblings:metadata.siblings.filter(file=>file.rfilename!=='config.json')};let calls=0;
 const found=await findHuggingFaceModels(repo,{fetcher:async()=>{calls++;return jsonResponse(withoutConfig);}});
 assert.equal(calls,1);assert.equal(found.architecture,'gguf');assert.deepEqual(found.files,[{path:'model-q4.gguf',bytes:24}]);
 const bytes=modelBytes(),file={path:'checked.gguf',bytes:bytes.length},repository={...found,files:[file]};
 const result=await inspectHuggingFaceModel(repository,file,{fetcher:async()=>new Response(bytes)});assert.equal(result.architecture,'qwen35');
 await assert.rejects(inspectHuggingFaceModel(repository,file,{fetcher:async()=>new Response(modelBytes(12))}),/No compatible local engine/);
});

test('download uses the pinned commit, verifies exact bytes, and removes its OPFS staging file on request',async()=>{
 let staged=false,removed=false;const bytes=modelBytes();let stored=new Uint8Array(),position=0;
 const handle={async createWritable(){return {async write(part){const chunk=new Uint8Array(part);const next=new Uint8Array(Math.max(stored.length,position+chunk.length));next.set(stored);next.set(chunk,position);stored=next;position+=chunk.length;},async seek(value){position=value;},async truncate(value){stored=stored.slice(0,value);position=Math.min(position,value);},async close(){staged=true;},async abort(){stored=new Uint8Array();}};},async getFile(){return new File([stored],'model-q4.gguf');}};
 const directory={async getDirectoryHandle(name){assert.equal(name,'model-download-staging');return {async getFileHandle(name){assert.match(name,/^download-[\da-f-]+\.gguf$/);return handle;},async removeEntry(){removed=true;}};}};
 const storage={async getDirectory(){return directory;}};let request;const ranges=[];
 const result=await downloadHuggingFaceModel({repo,revision:commit,license:null,architecture:'qwen35',files:[{path:'model-q4.gguf',bytes:bytes.length}]},{path:'model-q4.gguf',bytes:bytes.length},{storage,fetcher:async(url,options)=>{request={url,options};ranges.push(options.headers?.Range);return new Response(bytes,{status:206,headers:{'content-range':`bytes 0-${bytes.length-1}/${bytes.length}`,'content-length':String(bytes.length)}});}});
 assert.equal(staged,true);assert.equal(result.file.size,bytes.length);assert.deepEqual(Buffer.from(await result.file.arrayBuffer()),bytes);assert.deepEqual(result.source,{provider:'huggingface',repo,revision:commit,file:'model-q4.gguf',license:null});
 assert.match(request.url,new RegExp('/resolve/'+commit+'/model-q4\\.gguf\\?download=true$'));assert.equal(request.options.credentials,'omit');
 assert.deepEqual(ranges,[`bytes=0-${bytes.length-1}`,`bytes=0-${bytes.length-1}`]);
 await result.remove();assert.equal(removed,true);
});

test('large model range download retries a broken chunk from its OPFS offset without keeping partial bytes',async()=>{
 const bytes=modelBytes(),expectedRange=`bytes 0-${bytes.length-1}/${bytes.length}`;let stored=new Uint8Array(),position=0,fetchCount=0,staged=false;
 const handle={async createWritable(){return {async write(part){const chunk=new Uint8Array(part),next=new Uint8Array(Math.max(stored.length,position+chunk.length));next.set(stored);next.set(chunk,position);stored=next;position+=chunk.length;},async seek(value){position=value;},async truncate(value){stored=stored.slice(0,value);position=Math.min(position,value);},async close(){staged=true;},async abort(){stored=new Uint8Array();}};},async getFile(){return new File([stored],'model-q4.gguf');}};
 const storage={async getDirectory(){return {async getDirectoryHandle(){return {async getFileHandle(){return handle;},async removeEntry(){}};}};}};
 const fetcher=async(url,options)=>{
  fetchCount++;if(fetchCount===1)return new Response(bytes,{status:206,headers:{'content-range':expectedRange}});
  if(fetchCount===2){let sent=false;return new Response(new ReadableStream({pull(controller){if(!sent){sent=true;controller.enqueue(bytes.subarray(0,Math.floor(bytes.length/2)));}else controller.error(new TypeError('connection reset'));}}),{status:206,headers:{'content-range':expectedRange}});}
  return new Response(bytes,{status:206,headers:{'content-range':expectedRange,'content-length':String(bytes.length)}});
 };
 const file={path:'model-q4.gguf',bytes:bytes.length};const result=await downloadHuggingFaceModel({repo,revision:commit,license:null,architecture:'qwen35',files:[file]},file,{storage,fetcher});
 assert.equal(fetchCount,3);assert.equal(staged,true);assert.deepEqual(Buffer.from(await result.file.arrayBuffer()),bytes);await result.remove();
});

test('a browser storage quota failure is explained and the incomplete staged model is removed',async()=>{
 const bytes=modelBytes(),file={path:'model-q4.gguf',bytes:bytes.length},repository={repo,revision:commit,license:null,architecture:'qwen35',files:[file]};let writes=0,aborted=false,removed=false,requests=0;
 const handle={async createWritable(){return {async write(){writes++;throw new DOMException('The operation failed because it would cause the application to exceed its storage quota.','QuotaExceededError');},async abort(){aborted=true;}};},async getFile(){throw Error('Incomplete download must not be read');}};
 const storage={async getDirectory(){return {async getDirectoryHandle(){return {async getFileHandle(){return handle;},async removeEntry(){removed=true;}};}};}};
 const fetcher=async(url,options)=>{requests++;const [,startText,endText]=/bytes=(\d+)-(\d+)/.exec(options.headers.Range);const start=Number(startText),end=Number(endText);return new Response(bytes.subarray(start,end+1),{status:206,headers:{'content-range':`bytes ${start}-${end}/${bytes.length}`,'content-length':String(end-start+1)}});};
 await assert.rejects(downloadHuggingFaceModel(repository,file,{storage,fetcher}),/Not enough browser storage · free space and try again/);
 assert.equal(requests,2);assert.equal(writes,1);assert.equal(aborted,true);assert.equal(removed,true);
});

test('a temporary staging cleanup failure can be retried on the same downloaded model',async()=>{
 const bytes=modelBytes(),file={path:'model-q4.gguf',bytes:bytes.length},repository={repo,revision:commit,license:null,architecture:'qwen35',files:[file]};let removals=0;
 const handle={async createWritable(){return {async write(){},async close(){},async abort(){}};},async getFile(){return new File([bytes],file.path);}};
 const storage={async getDirectory(){return {async getDirectoryHandle(){return {async getFileHandle(){return handle;},async removeEntry(){if(++removals<=2)throw Error('temporary storage error');}};}};}};
 const fetcher=async(_url,options)=>{const [,startText,endText]=/bytes=(\d+)-(\d+)/.exec(options.headers.Range);const start=Number(startText),end=Number(endText);return new Response(bytes.subarray(start,end+1),{status:206,headers:{'content-range':`bytes ${start}-${end}/${bytes.length}`}});};
 const result=await downloadHuggingFaceModel(repository,file,{storage,fetcher});
 await assert.rejects(result.remove(),/temporary storage error/);await result.remove();assert.equal(removals,3);
});

test('quota and cleanup failures are both reported without claiming temporary storage was removed',async()=>{
 const bytes=modelBytes(),file={path:'model-q4.gguf',bytes:bytes.length},repository={repo,revision:commit,license:null,architecture:'qwen35',files:[file]};let removals=0;
 const handle={async createWritable(){return {async write(){throw new DOMException('Full','QuotaExceededError');},async abort(){}};}};
 const storage={async getDirectory(){return {async getDirectoryHandle(){return {async getFileHandle(){return handle;},async removeEntry(){if(++removals<=2)throw Error('private path');}};}};}};
 const fetcher=async(_url,options)=>{const [,a,b]=/bytes=(\d+)-(\d+)/.exec(options.headers.Range);const start=Number(a),end=Number(b);return new Response(bytes.subarray(start,end+1),{status:206,headers:{'content-range':`bytes ${start}-${end}/${bytes.length}`}});};
 let failure;try{await downloadHuggingFaceModel(repository,file,{storage,fetcher});assert.fail('expected failure');}catch(error){failure=error;}
 assert.match(failure.message,/Not enough browser storage.*temporary file not removed/i);assert.doesNotMatch(failure.message,/private path/);
 assert.equal(removals,2);await failure.retryCleanup();assert.equal(removals,3);
});

test('failed staging cleanup records its exact file for a later restart retry',async()=>{
 const {failedStagingNames,retrySessionStaging}=await import('../src/staging-cleanup.ts');
 const prior=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),data=new Map();
 const markers={get length(){return data.size;},key:i=>[...data.keys()][i]??null,getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};
 Object.defineProperty(globalThis,'localStorage',{value:markers,configurable:true});
 try{
  const bytes=modelBytes(),file={path:'model-q4.gguf',bytes:bytes.length},repository={repo,revision:commit,license:null,architecture:'qwen35',files:[file]};let removals=0,created='';
  const handle={async createWritable(){return {async write(){throw new DOMException('Full','QuotaExceededError');},async abort(){}};}};
  const directory={async getFileHandle(name){created=name;return handle;},async removeEntry(name){assert.equal(name,created);if(++removals<=2)throw Error('busy');}};
  const storage={async getDirectory(){return {async getDirectoryHandle(){return directory;}};}};
  const fetcher=async(_url,options)=>{const [,a,b]=/bytes=(\d+)-(\d+)/.exec(options.headers.Range);const start=Number(a),end=Number(b);return new Response(bytes.subarray(start,end+1),{status:206,headers:{'content-range':`bytes ${start}-${end}/${bytes.length}`}});};
  await assert.rejects(downloadHuggingFaceModel(repository,file,{storage,fetcher}),/temporary file not removed/);
  assert.deepEqual(failedStagingNames(markers),[created]);
  assert.deepEqual(await retrySessionStaging([],markers,storage),{pending:[],failed:false});assert.deepEqual(failedStagingNames(markers),[]);assert.equal(removals,3);
 }finally{if(prior)Object.defineProperty(globalThis,'localStorage',prior);else delete globalThis.localStorage;}
});

test('failure before staging file creation releases its lease and removes its marker',async()=>{
 const priorStorage=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),priorNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator'),data=new Map();let held=false;
 const markers={get length(){return data.size;},key:i=>[...data.keys()][i]??null,getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};
 const locks={async request(_name,callback){held=true;try{return await callback({});}finally{held=false;}}};
 Object.defineProperty(globalThis,'localStorage',{value:markers,configurable:true});Object.defineProperty(globalThis,'navigator',{value:{locks},configurable:true});
 try{
  const bytes=modelBytes(),file={path:'model-q4.gguf',bytes:bytes.length},repository={repo,revision:commit,license:null,architecture:'qwen35',files:[file]};
  const fetcher=async(_url,options)=>{const [,a,b]=/bytes=(\d+)-(\d+)/.exec(options.headers.Range);return new Response(bytes.subarray(Number(a),Number(b)+1),{status:206,headers:{'content-range':`bytes ${a}-${b}/${bytes.length}`}});};
  const storage={async getDirectory(){return {async getDirectoryHandle(){return {async getFileHandle(){throw Error('creation failed');}};}};}};
  await assert.rejects(downloadHuggingFaceModel(repository,file,{storage,fetcher}),/creation failed/);assert.equal(held,false);assert.equal(data.size,0);
 }finally{if(priorStorage)Object.defineProperty(globalThis,'localStorage',priorStorage);else delete globalThis.localStorage;if(priorNavigator)Object.defineProperty(globalThis,'navigator',priorNavigator);else delete globalThis.navigator;}
});

test('download keeps its native lease through review until the staged file is removed',{skip:!globalThis.navigator?.locks},async()=>{
 const {retryLeasedStaging,leasedStagingNames}=await import('../src/staging-cleanup.ts');
 const prior=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),data=new Map(),markers={get length(){return data.size;},key:i=>[...data.keys()][i]??null,getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};
 Object.defineProperty(globalThis,'localStorage',{value:markers,configurable:true});
 try{
  const bytes=modelBytes(),file={path:'model-q4.gguf',bytes:bytes.length},repository={repo,revision:commit,license:null,architecture:'qwen35',files:[file]};let output=[],removed=0;
  const handle={async createWritable(){return {async write(part){output.push(new Uint8Array(part));},async close(){}};},async getFile(){return new File(output,'model.gguf');}};
  const storage={async getDirectory(){return {async getDirectoryHandle(){return {async getFileHandle(){return handle;},async removeEntry(){removed++;}};}};}};
  const fetcher=async(_url,options)=>{const [,a,b]=/bytes=(\d+)-(\d+)/.exec(options.headers.Range);return new Response(bytes.subarray(Number(a),Number(b)+1),{status:206,headers:{'content-range':`bytes ${a}-${b}/${bytes.length}`}});};
  const result=await downloadHuggingFaceModel(repository,file,{storage,fetcher});
  try{assert.equal(leasedStagingNames(markers).length,1);assert.deepEqual(await retryLeasedStaging(markers,storage,navigator.locks),{removed:0,pending:1});assert.equal(removed,0);}
  finally{await result.remove();}
  assert.equal(removed,1);assert.deepEqual(leasedStagingNames(markers),[]);
 }finally{if(prior)Object.defineProperty(globalThis,'localStorage',prior);else delete globalThis.localStorage;}
});

test('unsupported remote quantization fails on bounded header inspection before a full download or staging',async()=>{
 const bytes=modelBytes(12),file={path:'unsupported.gguf',bytes:2*1024**3},repository={repo,revision:commit,license:null,architecture:'qwen35',files:[file]},requests=[];let staged=0;
 await assert.rejects(downloadHuggingFaceModel(repository,file,{storage:{async getDirectory(){staged++;throw Error('Must not stage');}},fetcher:async(url,options)=>{requests.push(options);if(!options.headers?.Range)throw Error('Full download started');const header=new Uint8Array(16*1024**2);header.set(bytes);return new Response(header,{status:206,headers:{'content-range':`bytes 0-${header.length-1}/${file.bytes}`}});}}),/No compatible local engine/);
 assert.equal(staged,0);assert.equal(requests.length,1);assert.equal(requests[0].headers.Range,'bytes=0-16777215');
});

test('range-ignoring servers are cancelled without reading a large body',async()=>{
 const file={path:'large.gguf',bytes:2*1024**3},repository={repo,revision:commit,license:null,architecture:'qwen35',files:[file]};let reads=0,cancelled=0;
 const body={getReader(){return {async read(){reads++;return {done:false,value:modelBytes()};},async cancel(){cancelled++;},releaseLock(){}};}};
 await assert.rejects(downloadHuggingFaceModel(repository,file,{storage:{async getDirectory(){throw Error('Must not stage');}},fetcher:async()=>({ok:true,status:200,headers:new Headers(),body})}),/range requests/);
 assert.equal(reads,0);assert.equal(cancelled,1);
});

test('header validation refuses changed ranges, truncated/oversized streams and architecture mismatch',async()=>{
 const bytes=modelBytes(),file={path:'model.gguf',bytes:bytes.length},repository={repo,revision:commit,license:null,architecture:'qwen35',files:[file]};
 await assert.rejects(inspectHuggingFaceModel(repository,file,{fetcher:async()=>new Response(bytes,{status:206,headers:{'content-range':`bytes 1-${bytes.length}/${bytes.length+1}`}})}),/size changed/);
 await assert.rejects(inspectHuggingFaceModel(repository,file,{fetcher:async()=>new Response(bytes.subarray(0,-1))}),/incomplete/);
 await assert.rejects(inspectHuggingFaceModel(repository,file,{fetcher:async()=>new Response(Buffer.concat([bytes,Buffer.alloc(1)]))}),/inspection budget/);
 await assert.rejects(inspectHuggingFaceModel({...repository,architecture:'lfm2'},file,{fetcher:async()=>new Response(bytes)}),/architecture does not match/);
});

test('Stop during header reading cancels the reader and prevents staging/full acquisition',async()=>{
 const bytes=modelBytes(),file={path:'model.gguf',bytes:bytes.length},repository={repo,revision:commit,license:null,architecture:'qwen35',files:[file]},controller=new AbortController();let cancelled=0,staged=0,requests=0;
 const body={getReader(){return {async read(){controller.abort();return {done:false,value:bytes};},async cancel(){cancelled++;},releaseLock(){}};}};
 await assert.rejects(downloadHuggingFaceModel(repository,file,{signal:controller.signal,storage:{async getDirectory(){staged++;}},fetcher:async()=>{requests++;return {ok:true,status:200,headers:new Headers(),body};}}),{name:'AbortError'});
 assert.equal(requests,1);assert.equal(staged,0);assert.ok(cancelled>0);
});

test('controlled PWA requires the exact one-request acknowledgement and an old worker fails explicitly',async()=>{
 const url='https://huggingface.co/api/models/owner/model?blobs=true';let message;
 await allowHuggingFaceRequest(url,'',{postMessage(data,[port]){message=data;port.postMessage({allowed:true});}});
 assert.deepEqual(message,{type:'allow-huggingface-request',url,range:''});
 await assert.rejects(allowHuggingFaceRequest(url,'',{postMessage(data,[port]){port.postMessage({allowed:false});}}),/not allowed/);
 await assert.rejects(allowHuggingFaceRequest(url,'',{postMessage(){}},undefined,5),/App update required/);
 const controller=new AbortController(),pending=allowHuggingFaceRequest(url,'',{postMessage(){}},controller.signal);controller.abort();await assert.rejects(pending,{name:'AbortError'});
 await allowHuggingFaceRequest(url,'',null);
});
