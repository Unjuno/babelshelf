// Optional read-only network probe. It does not prepare or run a model.
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
async function manifest(path){return JSON.parse(await readFile(new URL(path,root),'utf8'));}
const [bonsai,lfm,smol,qwen,decision,speech,ocr,vision]=await Promise.all([
 'dist/model-manifest.json','dist/lfm-model-manifest.json',
 'design/prototype/src/onnx-text-manifest.json','design/prototype/src/qwen-text-manifest.json',
 'design/prototype/src/decision-manifest.json','design/prototype/src/speech-manifest.json',
 'design/prototype/src/ocr-manifest.json','design/prototype/src/vision-manifest.json',
].map(manifest));
const entries=[
 {role:'text-runtime',name:'WebML',...bonsai.runtime.file},
 ...bonsai.models.map(model=>({role:'text',name:model.id,...model.file})),
 ...lfm.models.map(model=>({role:'text',name:model.id,...model.file})),
 ...[smol,qwen].flatMap(model=>model.files.map(file=>({role:'text',name:model.id+'/'+file.path,...file}))),
 ...decision.files.map(file=>({role:'decision',name:file.path,...file})),
 ...speech.files.map(file=>({role:'speech',name:file.path,...file})),
 ...ocr.data.map(file=>({role:'ocr',name:file.language,...file})),
 ...vision.files.map(file=>({role:'vision',name:file.path,...file,url:`https://huggingface.co/${vision.repository}/resolve/${vision.revision}/${file.path}`})),
];
const origin='https://babelshelf.com';
async function probe(entry){
 const response=await fetch(entry.url,{headers:{Range:'bytes=0-0',Origin:origin},signal:AbortSignal.timeout(20000)});
 try{
  const range=response.headers.get('content-range'),length=response.headers.get('content-length'),cors=response.headers.get('access-control-allow-origin');
  if(cors!=='*'&&cors!==origin)throw Error('CORS does not allow public origin');
  if(response.status===206){if(range!==`bytes 0-0/${entry.bytes}`)throw Error(`Range/size mismatch: ${range}`);}
  else if(response.status===200){if(length!==String(entry.bytes))throw Error(`Full response size unknown or wrong: ${length}`);}
  else throw Error(`HTTP ${response.status}`);
  return {role:entry.role,name:entry.name,status:response.status,bytes:entry.bytes};
 }finally{await response.body?.cancel();}
}
let next=0;const results=new Array(entries.length);
await Promise.all(Array.from({length:4},async()=>{
 for(;;){const index=next++;if(index>=entries.length)return;const entry=entries[index];
  try{results[index]=await probe(entry);}catch(error){results[index]={role:entry.role,name:entry.name,error:(error instanceof Error?error.message:String(error))};}
 }
}));
const failures=results.filter(result=>'error' in result);
console.log(JSON.stringify({checked:results.length,byRole:Object.fromEntries([...new Set(results.map(result=>result.role))].map(role=>[role,results.filter(result=>result.role===role).length])),rangeResponses:results.filter(result=>result.status===206).length,fullResponses:results.filter(result=>result.status===200).length,failures},null,2));
if(failures.length)process.exitCode=1;
