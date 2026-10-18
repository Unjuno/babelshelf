import {createServer} from '../../design/prototype/node_modules/vite/dist/node/index.js';
import {chromium} from '../../design/prototype/node_modules/playwright-core/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';import {resolve} from 'node:path';
const out=resolve(process.argv[2]);await mkdir(out,{recursive:false});
const server=await createServer({configFile:false,root:resolve('design/prototype'),server:{host:'127.0.0.1',port:0},plugins:[{name:'read-check',configureServer(s){s.middlewares.use((req,res,next)=>{if(req.url!=='/')return next();res.setHeader('content-type','text/html');res.end('<title>Read identity verification</title>');});}}]});await server.listen();
const b=await chromium.launch({channel:'chrome',headless:true}),p=await b.newPage();const evidence={scope:'Actual Chrome IndexedDB and production read package; fixture records, no inference or product UI claim'};
try{await p.goto('http://127.0.0.1:'+server.httpServer.address().port);evidence.results=await p.evaluate(async()=>{
 const {KnowledgeStore}=await import('/src/knowledge-store.ts'),{run}=await import('/src/tools/memory.read/tool.ts');
 const store=new KnowledgeStore('read-identity-'+crypto.randomUUID());
 await store.initialize([{id:'archive.md',path:'Inbox/original.md',version:1,body:'Exact identity'},{id:'other',path:'Notes/archive.md',version:1,body:'Other file'},{id:'third',path:'Inbox/archive.md',version:1,body:'Third file'}]);
 const before=JSON.stringify(await store.all()),host={views:()=>store.views(),search:q=>store.search(q),check(){}};
 const exact=await run({query:'archive.md'},host),path=await run({query:'Notes/archive.md'},host);
 if(exact.length!==1||exact[0].id!=='archive.md'||path.length!==1||path[0].id!=='other')throw Error('Wrong identity');
 if(JSON.stringify(await store.all())!==before)throw Error('Read changed records');
 return {exact:exact.map(n=>({id:n.id,path:n.path,version:n.version})),path:path.map(n=>n.id),unchanged:true};
});evidence.pass=true;}catch(e){evidence.pass=false;evidence.error=String(e);process.exitCode=1;}finally{await b.close();await server.close();await writeFile(out+'/evidence.json',JSON.stringify(evidence,null,2));console.log(evidence);}
