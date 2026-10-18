import {createServer} from '../../design/prototype/node_modules/vite/dist/node/index.js';
import {chromium} from '../../design/prototype/node_modules/playwright-core/index.mjs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const out=resolve(process.argv[2]);await mkdir(out,{recursive:false});
const fixture=await readFile(resolve('../../outputs/video-delayed-audio-qa.webm'));
const server=await createServer({configFile:false,root:resolve('design/prototype'),server:{host:'127.0.0.1',port:0},plugins:[{name:'mp4-check',configureServer(s){s.middlewares.use((req,res,next)=>{if(req.url==='/'){res.setHeader('content-type','text/html');res.end('<title>MP4 decoder check</title>');}else if(req.url==='/fixture'){res.setHeader('content-type','video/webm');res.end(fixture);}else next();});}}]});
await server.listen();const browser=await chromium.launch({channel:'chrome',headless:true});
const evidence={scope:'Native PC Chrome MP4 transcode and production decoder; no model, product UI or phone acceptance',inputSha256:createHash('sha256').update(fixture).digest('hex')};
try{
 const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.httpServer.address().port);
 const result=await page.evaluate(async()=>{
  const m=await import('/node_modules/mediabunny/dist/modules/src/index.js');
  const input=new m.Input({source:new m.BlobSource(await(await fetch('/fixture')).blob()),formats:[m.WEBM]});
  const target=new m.BufferTarget(),output=new m.Output({format:new m.Mp4OutputFormat(),target});
  try{
   const conversion=await m.Conversion.init({input,output,video:{codec:'avc',bitrate:200000},audio:{codec:'aac',bitrate:96000},copy:false});
   if(!conversion.isValid||conversion.discardedTracks.length)throw Error('Fixture conversion discarded a track');
   await conversion.execute();
  }finally{input.dispose();}
  const blob=new Blob([target.buffer],{type:'video/mp4'});
  const {decodeVideoAudio}=await import('/src/video-audio.ts');
  const decoded=await decodeVideoAudio(blob,new AbortController().signal);
  if(decoded.timing.startUs<4900000||decoded.timing.startUs>5100000)throw Error('Delayed audio offset lost');
  if(decoded.samples.length<120000||decoded.samples.length>140000||!decoded.samples.some(v=>Math.abs(v)>.001)||decoded.samples.some(v=>!Number.isFinite(v)))throw Error('Invalid real PCM');
  const video=document.createElement('video');video.preload='metadata';const url=URL.createObjectURL(blob);video.src=url;
  try{await new Promise((resolve,reject)=>{video.onloadedmetadata=resolve;video.onerror=()=>reject(Error('MP4 playback metadata failed'));});video.currentTime=decoded.timing.startUs/1e6;await new Promise((resolve,reject)=>{video.onseeked=resolve;video.onerror=()=>reject(Error('MP4 seek failed'));});
   return {bytes:Array.from(new Uint8Array(target.buffer)),timing:decoded.timing,samples:decoded.samples.length,durationMs:decoded.durationMs,playback:{duration:video.duration,currentTime:video.currentTime,paused:video.paused}};
  }finally{video.removeAttribute('src');video.load();URL.revokeObjectURL(url);}
 });
 const bytes=Buffer.from(result.bytes);delete result.bytes;await writeFile(out+'/delayed.mp4',bytes);
 evidence.result={...result,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};evidence.pass=true;
}catch(error){evidence.pass=false;evidence.error=String(error);process.exitCode=1;}
finally{await browser.close();await server.close();await writeFile(out+'/evidence.json',JSON.stringify(evidence,null,2));console.log(evidence);}
