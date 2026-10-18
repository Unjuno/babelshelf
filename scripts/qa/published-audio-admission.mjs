import {chromium} from '../../design/prototype/node_modules/playwright-core/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';
const out=resolve(process.argv[2]);await mkdir(out,{recursive:false});
const profile=resolve('../../outputs/unit197-public-preparation/profile');
const evidence={scope:'Public PC Chrome offline voice-file admission through normal UI; synthetic silent WAV, no transcription or inference accuracy claim',external:[]};
const c=await chromium.launchPersistentContext(profile,{channel:'chrome',headless:true,offline:true,viewport:{width:390,height:844}});
const p=c.pages()[0];c.setDefaultTimeout(30000);
c.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith('https://babelshelf.com/'))evidence.external.push(r.url());});
try{
 await p.goto('https://babelshelf.com/');
 evidence.build=await p.evaluate(()=>new Promise(resolve=>{const ch=new MessageChannel();ch.port1.onmessage=e=>resolve(e.data);navigator.serviceWorker.controller.postMessage('build',[ch.port2]);}));
 assert.equal(evidence.build.build,'f4f930b46ccdcb91');
 const draft='Keep this draft while checking an oversized audio file.';
 await p.getByRole('textbox',{name:'Message',exact:true}).fill(draft);
 await p.getByRole('button',{name:'Voice input',exact:true}).click();
 await p.getByRole('button',{name:'Choose audio',exact:true}).waitFor();
 const samples=16000*180,bytes=Buffer.alloc(44+samples*2);
 bytes.write('RIFF',0);bytes.writeUInt32LE(36+samples*2,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(16000,24);bytes.writeUInt32LE(32000,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(samples*2,40);
 const chooser=p.waitForEvent('filechooser');await p.getByRole('button',{name:'Choose audio',exact:true}).click();await(await chooser).setFiles({name:'three-minute-audio.wav',mimeType:'audio/wav',buffer:bytes});
 await p.getByTestId('bottom-sheet').getByText('Audio too long · maximum 2 minutes',{exact:true}).waitFor();
 assert.equal(await p.getByRole('button',{name:'Choose audio',exact:true}).isEnabled(),true);
 await p.screenshot({path:join(out,'audio-error.png')});
 await p.getByRole('button',{name:'Close',exact:true}).click();
 assert.equal(await p.getByRole('textbox',{name:'Message',exact:true}).inputValue(),draft);
 await p.getByRole('textbox',{name:'Message',exact:true}).fill('');
 assert.equal(evidence.external.length,0);evidence.pass=true;evidence.draftPreserved=true;evidence.retryAvailable=true;
}catch(e){evidence.pass=false;evidence.error=String(e);evidence.text=await p.locator('body').innerText();await p.screenshot({path:join(out,'failure.png')});process.exitCode=1;}
finally{await c.close();await writeFile(join(out,'evidence.json'),JSON.stringify(evidence,null,2));console.log(evidence);}

