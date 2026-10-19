import test from 'node:test';
import assert from 'node:assert/strict';
import {findHuggingFaceModels,downloadHuggingFaceModel} from '../src/huggingface-models.ts';

const commit='a'.repeat(40),repo='owner/model';
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

test('download uses the pinned commit, verifies exact bytes, and removes its OPFS staging file on request',async()=>{
 const chunks=[];let staged=false,removed=false;const bytes=new Uint8Array(24).fill(7);
 const handle={async createWritable(){return {async write(part){chunks.push(new Uint8Array(part));},async close(){staged=true;},async abort(){chunks.length=0;}};},async getFile(){return new File(chunks,'model-q4.gguf');}};
 const directory={async getDirectoryHandle(name){assert.equal(name,'model-download-staging');return {async getFileHandle(name){assert.match(name,/^download-[\da-f-]+\.gguf$/);return handle;},async removeEntry(){removed=true;}};}};
 const storage={async getDirectory(){return directory;}};let request;
 const result=await downloadHuggingFaceModel({repo,revision:commit,license:null,architecture:'qwen35',files:[{path:'model-q4.gguf',bytes:24}]},{path:'model-q4.gguf',bytes:24},{storage,fetcher:async(url,options)=>{request={url,options};return new Response(bytes);}});
 assert.equal(staged,true);assert.equal(result.file.size,24);assert.deepEqual(result.source,{provider:'huggingface',repo,revision:commit,file:'model-q4.gguf',license:null});
 assert.match(request.url,new RegExp('/resolve/'+commit+'/model-q4\\.gguf\\?download=true$'));assert.equal(request.options.credentials,'omit');
 await result.remove();assert.equal(removed,true);
});
