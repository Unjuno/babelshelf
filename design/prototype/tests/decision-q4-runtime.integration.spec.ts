import {createHash} from 'node:crypto';
import {createReadStream,readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import path from 'node:path';
import {expect,test} from '@playwright/test';

const enabled=process.env.BABELSHELF_RUN_D1_Q4_INTEGRATION==='1';
const modelDir=process.env.BABELSHELF_D1_Q4_MODEL_DIR;
const sourceRevision='4ebc1b97bf1477485371c79d1cf8d5e4e8eebfa0';
const assets=[
 {source:'config.json',file:'config.json',bytes:2433,sha256:'6402e50bd64e2d51c5f8dead2067d7873f30ec850f0cf1e732e4264b1576d313'},
 {source:'tokenizer.json',file:'tokenizer.json',bytes:4733371,sha256:'1efc3a6609abf6b63b1f47188d139f3b59973a6a434dffe970a7261a51ed2711'},
 {source:'tokenizer_config.json',file:'tokenizer_config.json',bytes:259,sha256:'03efc74b752b899b6292ff7e607738be59e6f206fec9aca32bbc05e9184090fc'},
 {source:'model_q4.onnx',file:'model_q4.onnx',bytes:443338,sha256:'45af3ce3b7911709bcd8c17fe925818b5488906ee5cf5863a907715e62c9ce7d'},
 {source:'model_q4.onnx_data',file:'model_q4.onnx_data',bytes:244221440,sha256:'04caae610a59e2ec5cc61d4804f79fdf75baf31bba93987c0efe1023245bbb64'},
] as const;

test('pinned D1 Q4 import resolves its embedded external-data name and creates a real WASM Decision session',async({page})=>{
 test.skip(!enabled||!modelDir,'Explicit opt-in: needs five hash-pinned D1 Q4 files in BABELSHELF_D1_Q4_MODEL_DIR; the weight data is about 244 MB.');
 test.setTimeout(20*60_000);
 for(const asset of assets){
  const data=readFileSync(path.join(modelDir!,asset.file));
  expect(data.byteLength,asset.file+' byte length').toBe(asset.bytes);
  expect(createHash('sha256').update(data).digest('hex'),asset.file+' SHA-256').toBe(asset.sha256);
 }
 const sourceServer=createServer((request,response)=>{
  const name=decodeURIComponent(new URL(request.url??'/', 'http://127.0.0.1').pathname.slice(1)),asset=assets.find(item=>item.source===name);
  if(!asset){response.writeHead(404);response.end('missing pinned test asset');return;}
  response.writeHead(200,{'access-control-allow-origin':'*','content-length':asset.bytes,'content-type':'application/octet-stream','cache-control':'no-store'});
  createReadStream(path.join(modelDir!,asset.file)).pipe(response);
 });
 await new Promise<void>((resolve,reject)=>{sourceServer.once('error',reject);sourceServer.listen(0,'127.0.0.1',()=>resolve());});
 const address=sourceServer.address();if(!address||typeof address==='string')throw Error('Could not start isolated Q4 asset server');
 try{
 await page.goto('/tests/runtime-fixture.html');
 const result=await page.evaluate(async({files,assetOrigin})=>{
  const paths=files.map(file=>assetOrigin+'/'+encodeURIComponent(file)),localFiles=await Promise.all(paths.map(async url=>{
   const response=await fetch(url);if(!response.ok)throw Error('Q4 test fixture unavailable · '+url);
   const name=url.split('/').at(-1)!;return new File([await response.arrayBuffer()],name);
  }));
  const {inspectCustomDecisionModel,importCustomDecisionModel}=await import('/src/decision-assets.ts');
  const review=await inspectCustomDecisionModel(localFiles);
  const imported=await importCustomDecisionModel(review,new AbortController().signal);
  const graphBytes=new Uint8Array(await localFiles.find(file=>file.name==='model_q4.onnx')!.arrayBuffer());
  const {onnxGraphExternalDataLocation,onnxGraphHasOperator}=await import('/src/onnx-graph.ts');
  const graphEvidence={location:onnxGraphExternalDataLocation(graphBytes),gatherBlockQuantized:onnxGraphHasOperator(graphBytes,'GatherBlockQuantized')};
  const worker=new Worker('/src/decision-worker.ts',{type:'module'}),progress:string[]=[];let nextId=0;
  const operation=(type:string,extra:Record<string,unknown>={})=>new Promise<any>((resolve,reject)=>{
   const id='d1-q4-integration-'+(++nextId),timer=setTimeout(()=>reject(Error(type+' timed out')),15*60_000);
   const cleanup=()=>{clearTimeout(timer);worker.removeEventListener('message',onMessage);worker.removeEventListener('error',onError);worker.removeEventListener('messageerror',onMessageError);};
   const onError=(event:ErrorEvent)=>{cleanup();reject(Error(type+' worker error · '+JSON.stringify({message:event.message,filename:event.filename,lineno:event.lineno,colno:event.colno,stack:(event.error as Error|undefined)?.stack??null})));};
   const onMessageError=()=>{cleanup();reject(Error(type+' worker message could not be cloned'));};
   const onMessage=(event:MessageEvent)=>{const data=event.data;if(data?.id!==id)return;if(data.progress){progress.push(data.progress);console.log('D1 Q4 integration · '+data.progress);return;}cleanup();data.error?reject(Error(type+' failed · '+data.error)):resolve(data.value);};
   worker.addEventListener('message',onMessage);worker.addEventListener('error',onError);worker.addEventListener('messageerror',onMessageError);worker.postMessage({id,type,model:imported,...extra});
  });
  try{
   const loaded=await operation('load');
   const classified=await operation('classify',{state:'Statement: Paris is the capital of France. The statement is true.',question:{type:'noul',instructions:'Is the statement true?'}});
   return {imported:{id:imported.id,files:imported.files},graphEvidence,loaded,classified,progress};
  }finally{worker.terminate();}
 },{files:assets.map(asset=>asset.source),assetOrigin:'http://127.0.0.1:'+address.port});
 expect(result.imported.files.map((file:{path:string})=>file.path)).toEqual(['config.json','tokenizer.json','tokenizer_config.json','onnx/model_quantized.onnx','onnx/model_quantized.onnx_data']);
 expect(result.graphEvidence).toEqual({location:'model_q4.onnx_data',gatherBlockQuantized:true});
 expect(result.loaded).toMatchObject({prepared:true,loaded:true,device:'wasm'});
 expect(result.progress).toContain('WebGPU skipped · GatherBlockQuantized is unsupported by this WebGPU runtime · using WASM');
 expect(result.progress).toContain('Loading · WASM');
 expect(result.classified).toMatchObject({scope:'text-only',device:'wasm',answer:{type:'noul',answer:true}});
 console.log('D1 Q4 pinned ONNX session + inference passed · source '+sourceRevision+' · '+result.imported.id);
 }finally{await new Promise<void>((resolve,reject)=>sourceServer.close(error=>error?reject(error):resolve()));}
});
