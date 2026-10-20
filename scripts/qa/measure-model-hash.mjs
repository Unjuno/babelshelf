// Node CPU measurement of the production streaming verifier, not inference.
import {openAsBlob} from 'node:fs';
import {readFile,writeFile} from 'node:fs/promises';
import os from 'node:os';
import {hashLocalModel} from '../../dist/local-models.js';
import {streamingSHA256Backend} from '../../dist/streaming-sha256.js';
const [id,path,mode='js',output]=process.argv.slice(2);
if(!id||!path||!output||!['js','wasm'].includes(mode))throw Error('Use: node scripts/qa/measure-model-hash.mjs MODEL_ID FILE js|wasm OUTPUT.json');
const manifest=JSON.parse(await readFile(new URL('../../dist/model-manifest.json',import.meta.url),'utf8')),model=manifest.models.find(m=>m.id===id);
if(!model)throw Error('Unknown pinned model');
if(mode==='wasm')await import('../../design/prototype/src/fast-hash.ts');
const file=await openAsBlob(path);if(file.size!==model.file.bytes)throw Error('Model size mismatch');
let peakRss=process.memoryUsage().rss;const timer=setInterval(()=>{peakRss=Math.max(peakRss,process.memoryUsage().rss);},20),cpu=process.cpuUsage(),started=performance.now();
let sha256;try{sha256=await hashLocalModel(file);}finally{clearInterval(timer);}
const elapsedMs=performance.now()-started,used=process.cpuUsage(cpu);
const result={schema:1,scope:'Node CPU streaming file verification; no model inference or phone evidence',at:new Date().toISOString(),device:os.cpus()[0]?.model,os:{platform:os.platform(),release:os.release(),arch:os.arch()},runtime:process.version,browser:null,model:id,revision:model.revision,quantization:model.format,bytes:file.size,requestedBackend:mode,backend:streamingSHA256Backend(),inputTokens:null,outputTokens:null,conditions:{fileCache:'uncontrolled',streaming:true,network:false},verificationMs:elapsedMs,MiBPerSecond:file.size/1048576/(elapsedMs/1000),cpuUserMs:used.user/1000,cpuSystemMs:used.system/1000,peakProcessRssBytes:peakRss,sha256,expectedSha256:model.file.sha256,verified:sha256===model.file.sha256};
await writeFile(output,JSON.stringify(result,null,2));console.log(JSON.stringify(result));if(!result.verified)process.exitCode=1;
