// Loopback-only review/transaction QA; never package the fixture in the app.
import http from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {createStaticHandler} from '../serve.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),[output,port='4261']=process.argv.slice(2);
if(!output||!/^\d{4,5}$/.test(port))throw Error('Use NEW_OUTPUT [PORT]');
const out=path.resolve(output),app=path.join(root,'design/prototype/dist/app'),build=JSON.parse(await readFile(path.join(app,'build.json'),'utf8'));
await mkdir(out,{recursive:false});
const {build:bundle}=await import(pathToFileURL(path.join(root,'design/prototype/node_modules/vite/dist/node/index.js')).href);
await bundle({configFile:false,build:{lib:{entry:path.join(root,'scripts/qa/dialogue-copy-check.ts'),formats:['es'],fileName:()=> 'check.js'},outDir:out,minify:false,emptyOutDir:false}});
const identity={build:build.build,fixtureSha256:createHash('sha256').update(await readFile(path.join(out,'check.js'))).digest('hex')};
const page=`<!doctype html><meta charset="utf-8"><title>Dialogue copy QA</title><style>body{font:18px system-ui;margin:2em;color:#142d25;background:#f4faf7}button,a{font:inherit;padding:14px;margin:8px}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style><h1>Dialogue copy QA</h1><p>Controlled local originals and real IndexedDB. No model inference or public user data.</p><button id="prepare">Prepare review fixture</button><button id="transactions">Verify transactions</button><button id="inspect">Inspect saved review</button><a href="/">Open app</a><pre id="result">Not run</pre><a id="save" hidden>Save result</a><script type="module">
import {prepareReviewFixture,verifyTransactions,inspectSavedReview} from '/check.js';
const result={identity:${JSON.stringify(identity)},userAgent:navigator.userAgent,at:new Date().toISOString()};let url;
for(const [id,fn]of [['prepare',prepareReviewFixture],['transactions',verifyTransactions],['inspect',inspectSavedReview]])document.getElementById(id).onclick=async()=>{const button=document.getElementById(id);button.disabled=true;try{result[id]=await fn();}catch(error){result[id]={error:error.message};}finally{button.disabled=false;document.getElementById('result').textContent=JSON.stringify(result,null,2);if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'}));const save=document.getElementById('save');save.href=url;save.download='dialogue-copy-browser.json';save.hidden=false;}};
</script>`;
await writeFile(path.join(out,'index.html'),page);
const product=createStaticHandler(app),qa=createStaticHandler(out);
const server=http.createServer((req,res)=>{const pathname=new URL(req.url,'http://127.0.0.1').pathname;if(pathname==='/check'){req.url='/index.html';return qa(req,res);}if(pathname==='/check.js')return qa(req,res);return product(req,res);});
server.listen(Number(port),'127.0.0.1',()=>console.log('Loopback review QA http://127.0.0.1:'+port+'/check / build '+build.build));
