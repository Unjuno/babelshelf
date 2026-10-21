// Isolated loopback SIMD/CPU check. No model assets, preparation or app storage.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
const [directory,port='4264']=process.argv.slice(2);if(!directory||!/^\d{4,5}$/.test(port))throw Error('Use PROBE_DIRECTORY [PORT]');
const root=resolve(directory),hash=b=>createHash('sha256').update(b).digest('hex'),build=JSON.parse(await readFile(join(root,'build.json'),'utf8')),files=new Map();
for(const pin of build.files){const raw=await readFile(join(root,pin.path));if(raw.length!==pin.bytes||hash(raw)!==pin.sha256)throw Error('Probe pin mismatch');files.set('/'+pin.path,raw);}
const cases=await readFile(new URL('./qwen3-q2-cpu-cases.mjs',import.meta.url));files.set('/cases.mjs',cases);
const identity={build,casesSha256:hash(cases)};
const page=`<!doctype html><meta charset="utf-8"><title>Q2 CPU kernel check</title><style>body{font:18px system-ui;margin:2em;color:#142d25;background:#f4faf7}button,a{font:inherit;padding:14px}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style><h1>Q2 CPU kernel check</h1><p>Frozen CPU archives · WASM SIMD · no model load or generation.</p><button id="run">Run CPU check</button><pre id="result">Not run</pre><a id="save" hidden>Save result</a><script type="module">
import create from '/probe.mjs';import {runQwen3Q2CpuProbe} from '/cases.mjs';
const result={identity:${JSON.stringify(identity)},scope:'Actual sidebar browser WebAssembly SIMD, fixed-source compat CPU archives; no model loading/inference/storage writes',at:new Date().toISOString(),userAgent:navigator.userAgent,crossOriginIsolated,passed:false};
document.querySelector('#run').onclick=async()=>{document.querySelector('#run').disabled=true;try{if(!crossOriginIsolated)throw Error('Shared memory requires isolation');const api=await create();Object.assign(result,runQwen3Q2CpuProbe(api));}catch(error){result.error=error.message;}document.querySelector('#result').textContent=JSON.stringify(result,null,2);const a=document.querySelector('#save');a.href=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'}));a.download='qwen3-q2-cpu-browser.json';a.hidden=false;};
</script>`;
http.createServer((req,res)=>{const pathname=new URL(req.url,'http://127.0.0.1').pathname,body=pathname==='/'?Buffer.from(page):files.get(pathname);if(!body||!['GET','HEAD'].includes(req.method)){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':pathname==='/'?'text/html; charset=utf-8':pathname.endsWith('.wasm')?'application/wasm':'text/javascript; charset=utf-8','Content-Length':body.length,'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:body);}).listen(Number(port),'127.0.0.1',()=>console.log('QA-only CPU probe http://127.0.0.1:'+port));
