
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from '../../design/prototype/node_modules/vite/dist/node/index.js';
import {chromium} from '../../design/prototype/node_modules/playwright-core/index.mjs';
const out=resolve(process.argv[2]);await mkdir(out,{recursive:false});
const evidence={scope:'Actual React task hook and Chrome IndexedDB with an injected one-time display-refresh failure; no model inference or product-screen acceptance.'};
const source=`
import React from 'react';import {createRoot} from 'react-dom/client';
import {useTasks} from './src/useTasks';import {knowledge} from './src/useKnowledge';
import {taskRunView} from './src/task-records';
await knowledge.initialize([]);
const id=crypto.randomUUID();await knowledge.putTask({repeat:'once',time:'12:00',days:[],date:'2099-01-01',monthDay:1,interval:1,unit:'days',timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,enabled:false,notify:true,prompt:'Refresh failure fixture'},undefined,undefined,id);
window.calls=0;let failRefresh=true;
function App(){const controller=useTasks([],false,false,async()=>{if(failRefresh){failRefresh=false;throw Error('Controlled refresh failure');}},async()=>{window.calls++;throw Error('Controlled execution failure');});
return React.createElement('button',{onClick:async()=>{try{await controller.run(id,window.retry===true);}catch(e){window.error=e.message;}window.done=true;}},'Run');}
window.inspect=async()=>{const snapshot=await knowledge.snapshot();return {task:snapshot.notes.find(n=>n.id===id),executions:snapshot.notes.filter(n=>n.ui?.recordType==='execution').map(n=>({id:n.id,revisions:n.revisions,data:taskRunView(n)}))};};
createRoot(document.getElementById('root')).render(React.createElement(App));
`;
const server=await createServer({configFile:false,root:resolve('design/prototype'),server:{host:'127.0.0.1',port:0},plugins:[{name:'task-refresh-fixture',resolveId(id){if(id==='/qa-test.ts')return resolve('design/prototype/qa-test.ts').replaceAll('\\','/');},load(id){if(id===resolve('design/prototype/qa-test.ts').replaceAll('\\','/'))return source;},configureServer(server){server.middlewares.use((req,res,next)=>{if(req.url!=='/')return next();res.setHeader('content-type','text/html');res.end('<div id="root"></div><script type="module" src="/qa-test.ts"></script>');});}}]});
await server.listen();let browser;
try{browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();page.on('pageerror',e=>console.error(e.message));page.on('console',m=>{if(m.type()==='error')console.error(m.text());});await page.goto('http://127.0.0.1:'+server.httpServer.address().port);await page.getByRole('button',{name:'Run',exact:true}).waitFor();
evidence.before=await page.evaluate(()=>window.inspect());await page.getByRole('button',{name:'Run',exact:true}).click();await page.waitForFunction(()=>window.done);
evidence.after=await page.evaluate(async()=>({...(await window.inspect()),calls:window.calls,error:window.error}));
if(evidence.after.calls!==0||evidence.after.executions.length!==1||evidence.after.executions[0].data.status!=='failed'||evidence.after.executions[0].data.error!=='Controlled refresh failure')throw Error('Claimed occurrence was not recorded failed before inference');
await page.evaluate(()=>{window.retry=true;window.done=false;});await page.getByRole('button',{name:'Run',exact:true}).click();await page.waitForFunction(()=>window.done);
evidence.retry=await page.evaluate(async()=>({...(await window.inspect()),calls:window.calls}));
if(evidence.retry.calls!==1||evidence.retry.executions.length!==1||evidence.retry.executions[0].id!==evidence.after.executions[0].id||evidence.retry.executions[0].data.attempt!==2||evidence.retry.executions[0].data.status!=='failed')throw Error('Explicit retry did not retain the occurrence');
if(JSON.stringify(evidence.before.task)!==JSON.stringify(evidence.retry.task))throw Error('Failed attempt consumed or changed task');evidence.pass=true;
}catch(e){evidence.pass=false;evidence.error=String(e);process.exitCode=1;}finally{await browser?.close();await server.close();await writeFile(resolve(out,'evidence.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify({pass:evidence.pass,error:evidence.error,output:out}));}
