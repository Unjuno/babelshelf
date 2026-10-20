import test from 'node:test';
import assert from 'node:assert/strict';
import {findHuggingFaceModels,downloadHuggingFaceModel,inspectHuggingFaceModel} from '../src/huggingface-models.ts';
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
 await assert.rejects(findHuggingFaceModels('owner/model',{fetcher:async(url)=>url.includes('/api/models/')?jsonResponse(metadata):jsonResponse({model_type:'qwen3'})}),/Qwen3 needs a connected local engine/);
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
 const chunks=[];let staged=false,removed=false;const bytes=modelBytes();
 const handle={async createWritable(){return {async write(part){chunks.push(new Uint8Array(part));},async close(){staged=true;},async abort(){chunks.length=0;}};},async getFile(){return new File(chunks,'model-q4.gguf');}};
 const directory={async getDirectoryHandle(name){assert.equal(name,'model-download-staging');return {async getFileHandle(name){assert.match(name,/^download-[\da-f-]+\.gguf$/);return handle;},async removeEntry(){removed=true;}};}};
 const storage={async getDirectory(){return directory;}};let request;const ranges=[];
 const result=await downloadHuggingFaceModel({repo,revision:commit,license:null,architecture:'qwen35',files:[{path:'model-q4.gguf',bytes:bytes.length}]},{path:'model-q4.gguf',bytes:bytes.length},{storage,fetcher:async(url,options)=>{request={url,options};ranges.push(options.headers?.Range);return new Response(bytes);}});
 assert.equal(staged,true);assert.equal(result.file.size,bytes.length);assert.deepEqual(result.source,{provider:'huggingface',repo,revision:commit,file:'model-q4.gguf',license:null});
 assert.match(request.url,new RegExp('/resolve/'+commit+'/model-q4\\.gguf\\?download=true$'));assert.equal(request.options.credentials,'omit');
 assert.deepEqual(ranges,[`bytes=0-${bytes.length-1}`,undefined]);
 await result.remove();assert.equal(removed,true);
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
