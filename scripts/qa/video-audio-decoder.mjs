import {createServer} from '../../design/prototype/node_modules/vite/dist/node/index.js';
import {chromium} from '../../design/prototype/node_modules/playwright-core/index.mjs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';import {resolve} from 'node:path';
const out=resolve(process.argv[2]);await mkdir(out,{recursive:false});const fixture=await readFile(resolve('../../outputs/video-delayed-audio-qa.webm'));
const server=await createServer({configFile:false,root:resolve('design/prototype'),server:{host:'127.0.0.1',port:0},plugins:[{name:'video-decoder',configureServer(s){s.middlewares.use((req,res,next)=>{if(req.url==='/'){res.setHeader('content-type','text/html');res.end('<title>Video decoder check</title>');}else if(req.url==='/fixture.webm'){res.setHeader('content-type','video/webm');res.end(fixture);}else next();});}}]});await server.listen();
const b=await chromium.launch({channel:'chrome',headless:true}),p=await b.newPage();const evidence={scope:'Actual Chrome production decoder module and delayed WebM; real PCM/resampling, not model or normal product UI acceptance'};
try{await p.goto('http://127.0.0.1:'+server.httpServer.address().port);evidence.result=await p.evaluate(async()=>{
 const {decodeVideoAudio}=await import('/src/video-audio.ts'),blob=await(await fetch('/fixture.webm')).blob();
 const r=await decodeVideoAudio(blob,new AbortController().signal);
 if(r.timing.startUs!==5001000||r.timing.endUs!==13121000||r.durationMs!==8120||r.samples.length!==129920)throw Error('Timeline or padding mismatch');
 if(!r.samples.some(v=>Math.abs(v)>.001)||r.samples.some(v=>!Number.isFinite(v)))throw Error('Missing decoded PCM');
 const stop=new AbortController();stop.abort();let error;try{await decodeVideoAudio(blob,stop.signal);}catch(e){error=e.message;}if(error!=='Stopped')throw Error('Already-aborted decode continued');
 const active=new AbortController(),pending=decodeVideoAudio(blob,active.signal);active.abort();try{await pending;}catch(e){error=e.message;}if(error!=='Stopped')throw Error('Decode cancellation lost');
 return {timing:r.timing,durationMs:r.durationMs,samples:r.samples.length,pcmPresent:true,stopped:true};
});evidence.pass=true;}catch(e){evidence.pass=false;evidence.error=String(e);process.exitCode=1;}finally{await b.close();await server.close();await writeFile(out+'/evidence.json',JSON.stringify(evidence,null,2));console.log(evidence);}
