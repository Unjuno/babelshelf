import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {stripTypeScriptTypes} from 'node:module';
import {createHash} from 'node:crypto';
import {chromium} from '../../design/prototype/node_modules/playwright-core/index.mjs';
const out=process.argv[2],root=process.cwd();await mkdir(out,{recursive:false});
const evidence={scope:'Actual Chrome MediaRecorder with synthetic browser audio device; deliberate error event, cancellation and timed normal capture/decode. Not hardware microphone, transcription, inference or ordinary product UI evidence.',sources:{}};
for(const file of ['design/prototype/src/recording-session.ts'])evidence.sources[file]=createHash('sha256').update(await readFile(file)).digest('hex');
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');if(url.pathname==='/'){res.setHeader('content-type','text/html');res.end('<!doctype html><title>Isolated task transaction check</title>');return;}
 let file=resolve(root,'.'+decodeURIComponent(url.pathname));if(!file.startsWith(root+sep))throw Error('Outside fixture root');
 if(!extname(file))file+='.ts';const extension=extname(file);if(!['.ts','.js','.json'].includes(extension))throw Error('Unsupported fixture resource');
 const source=await readFile(file,'utf8');res.setHeader('cache-control','no-store');res.setHeader('content-type',extension==='.json'?'application/json':'text/javascript');res.end(extension==='.ts'?stripTypeScriptTypes(source):source);
 }catch(e){res.statusCode=404;res.end(String(e));}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
try{browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});const p=await browser.newPage();await p.goto('http://127.0.0.1:'+server.address().port+'/');
 evidence.result=await p.evaluate(async()=>{
  const {startRecording}=await import('/design/prototype/src/recording-session.ts'),assert=(v,m)=>{if(!v)throw Error(m);},wait=ms=>new Promise(r=>setTimeout(r,ms));
  const stream=await navigator.mediaDevices.getUserMedia({audio:true}),r=new MediaRecorder(stream),errors=[],completed=[];
  const cancel=startRecording(r,{complete:b=>completed.push(b),error:e=>errors.push(e)});
  await wait(100);await new Promise(resolve=>{r.addEventListener('dataavailable',resolve,{once:true});r.requestData();});
  const error=new Event('error');Object.defineProperty(error,'error',{value:new DOMException('Controlled capture error','UnknownError')});r.dispatchEvent(error);cancel();await wait(100);
  assert(stream.getTracks().every(t=>t.readyState==='ended')&&r.state==='inactive','Error retained capture');assert(completed.length===0&&errors.length===1&&errors[0]==='Controlled capture error','Failed bytes submitted or error duplicated');
  const cancelled=await navigator.mediaDevices.getUserMedia({audio:true}),c=new MediaRecorder(cancelled),unexpected=[];
  const discard=startRecording(c,{complete:()=>unexpected.push('complete'),error:()=>unexpected.push('error')});discard();discard();await wait(100);
  assert(cancelled.getTracks().every(t=>t.readyState==='ended')&&unexpected.length===0,'Cancellation leaked or submitted audio');
  const normal=await navigator.mediaDevices.getUserMedia({audio:true}),n=new MediaRecorder(normal);
  const blob=await new Promise((resolve,reject)=>startRecording(n,{complete:resolve,error:reject},250));assert(blob.size>0,'Timed capture empty');
  const bytes=await blob.arrayBuffer(),audio=new AudioContext();let duration;try{duration=(await audio.decodeAudioData(bytes.slice(0))).duration;}finally{await audio.close();}
  assert(duration>0&&normal.getTracks().every(t=>t.readyState==='ended'),'Completed audio unavailable or microphone retained');
  return {errorReleased:true,failedBytesDiscarded:true,cancelReleased:true,normalCapture:{bytes:bytes.byteLength,type:blob.type,duration,sha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('')}};
 });evidence.pass=true;
}catch(e){evidence.pass=false;evidence.error=String(e);process.exitCode=1;}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));await writeFile(out+'/evidence.json',JSON.stringify(evidence,null,2));console.log(evidence);}
