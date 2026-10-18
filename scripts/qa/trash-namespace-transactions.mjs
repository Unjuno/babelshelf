import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {stripTypeScriptTypes} from 'node:module';
import {createHash} from 'node:crypto';
import {chromium} from '../../design/prototype/node_modules/playwright-core/index.mjs';
const out=process.argv[2],root=process.cwd();await mkdir(out,{recursive:false});
const evidence={scope:'Actual Chrome isolated IndexedDB sparse-folder delete/replacement-file/Trash restore namespace refusal, all-store rollback; controlled data not inference or ordinary UI',sources:{}};
for(const file of ['design/prototype/src/knowledge-store.ts','design/prototype/src/task-records.ts','dist/core.js'])evidence.sources[file]=createHash('sha256').update(await readFile(file)).digest('hex');
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');if(url.pathname==='/'){res.setHeader('content-type','text/html');res.end('<!doctype html><title>Isolated task transaction check</title>');return;}
 let file=resolve(root,'.'+decodeURIComponent(url.pathname));if(!file.startsWith(root+sep))throw Error('Outside fixture root');
 if(!extname(file))file+='.ts';const extension=extname(file);if(!['.ts','.js','.json'].includes(extension))throw Error('Unsupported fixture resource');
 const source=await readFile(file,'utf8');res.setHeader('cache-control','no-store');res.setHeader('content-type',extension==='.json'?'application/json':'text/javascript');res.end(extension==='.ts'?stripTypeScriptTypes(source):source);
 }catch(e){res.statusCode=404;res.end(String(e));}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
try{browser=await chromium.launch({channel:'chrome',headless:true});const p=await browser.newPage();await p.goto('http://127.0.0.1:'+server.address().port+'/');
 evidence.result=await p.evaluate(async()=>{
  const {KnowledgeStore}=await import('/design/prototype/src/knowledge-store.ts');const assert=(v,m)=>{if(!v)throw Error(m);},same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),store=new KnowledgeStore('qa-trash-namespace-'+crypto.randomUUID());await store.initialize([]);await store.createFolder('Notes/branch.md/deep',undefined);const removed=await store.recoverMemory({kind:'delete',target:{kind:'folder',value:'Notes/branch.md/deep'},expectedNotes:[],id:'recover-leaf',label:'Deep folder'},await store.getState('folders'),undefined);await store.commit([], [{id:'new-file',path:'Notes/branch.md',body:'Keep replacement file',version:1,history:[]}]);const before=await store.snapshot();let rejected='';try{await store.recoverMemory({kind:'restore',batch:removed.trash[0]},await store.getState('folders'),await store.getState('trash'));}catch(e){rejected=e.message;}assert(/conflict|collid/i.test(rejected),'Restoration put a directory below a current file');assert(same(await store.snapshot(),before),'Rejected recovery changed records or Trash');return {refused:rejected,allStoresUnchanged:true};
 });evidence.pass=true;
}catch(e){evidence.pass=false;evidence.error=String(e);process.exitCode=1;}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));await writeFile(out+'/evidence.json',JSON.stringify(evidence,null,2));console.log({pass:evidence.pass,error:evidence.error});}
