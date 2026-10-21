// Explicit QA acquisition only. Never an app download or inference backend.
// Streaming keeps the full 2.31GB checkpoint out of JS memory. Do not commit it.
import {createWriteStream,createReadStream,openAsBlob} from 'node:fs';
import {stat,rename,writeFile} from 'node:fs/promises';
import {pipeline} from 'node:stream/promises';
import {Readable,Transform} from 'node:stream';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import os from 'node:os';
import {inspectGGUF} from '../../dist/gguf-inspect.js';
import {eligibleTextEngine} from '../../dist/local-engines.js';
import {bonsai8bPin as pin} from './bonsai8b-pin.mjs';
const [targetArg,evidenceArg]=process.argv.slice(2);
if(!targetArg||!evidenceArg)throw Error('Use NEW_PRIVATE_MODEL_PATH NEW_EVIDENCE.json');
const target=resolve(targetArg),evidence=resolve(evidenceArg);
// Resolve only a fixed primary-host resource; no credentials, user data or code.
const url=`https://huggingface.co/${pin.repository}/resolve/${pin.revision}/${pin.file}`;
let existing=false;try{const value=await stat(target);if(!value.isFile()||value.size!==pin.bytes)throw Error('Existing target size mismatch');existing=true;}catch(error){if(error.code!=='ENOENT')throw error;}
const started=performance.now(),hash=createHash('sha256');let bytes=0,last=0;
const meter=new Transform({transform(chunk,_encoding,done){bytes+=chunk.length;if(bytes>pin.bytes){done(Error('Model exceeds pinned size'));return;}hash.update(chunk);const now=performance.now();if(now-last>15000){last=now;console.log(JSON.stringify({phase:existing?'Verifying existing file':'Downloading',bytes,total:pin.bytes}));}done(null,chunk);}});
if(existing){for await(const part of createReadStream(target,{highWaterMark:1024*1024})){bytes+=part.length;hash.update(part);}}
else{
 const response=await fetch(url,{headers:{'Accept-Encoding':'identity'},signal:AbortSignal.timeout(1800000)});
 if(!response.ok||!response.body||response.headers.get('content-length')&&Number(response.headers.get('content-length'))!==pin.bytes)throw Error('Pinned model HTTP response mismatch');
 await pipeline(Readable.fromWeb(response.body),meter,createWriteStream(target+'.partial',{flags:'wx',highWaterMark:256*1024}));
}
const sha256=hash.digest('hex');if(bytes!==pin.bytes||sha256!==pin.sha256)throw Error('Full model integrity mismatch; partial file retained for inspection');
if(!existing)await rename(target+'.partial',target);
const inspection=await inspectGGUF(await openAsBlob(target)),engine=eligibleTextEngine(inspection)?.id??null;
const result={schema:1,at:new Date().toISOString(),scope:'Exact-revision full model acquisition, SHA256 and bounded GGUF inspection; no loading/generation or device-fit claim',pin,source:url,os:{platform:os.platform(),release:os.release(),arch:os.arch()},node:process.version,elapsedMs:performance.now()-started,existing,bytes,sha256,inspection,eligibleAdapter:engine,weightsVerified:true,generationVerified:false,offlineVerified:false,passed:engine==='wllama-qwen3'&&inspection.tensorTypes.every(type=>[0,42].includes(type))};
await writeFile(evidence,JSON.stringify(result,null,2),{flag:'wx'});console.log(JSON.stringify({passed:result.passed,bytes,sha256,eligibleAdapter:engine,elapsedMs:result.elapsedMs}));if(!result.passed)process.exitCode=1;
