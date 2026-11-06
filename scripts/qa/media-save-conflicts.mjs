import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {stripTypeScriptTypes} from 'node:module';
import {createHash} from 'node:crypto';
import {chromium} from '../../design/prototype/node_modules/playwright-core/index.mjs';
const out=process.argv[2],root=process.cwd();await mkdir(out,{recursive:true});
const evidence={scope:'Actual Chrome isolated IndexedDB extraction conflict errors and all-store rollback; controlled extraction fixtures, no recognition/inference or ordinary UI claim',sources:{}};
for(const file of ['design/prototype/src/knowledge-store.ts','design/prototype/src/pdf-text.ts','design/prototype/src/ocr-text.ts','design/prototype/src/speech-transcript.ts','design/prototype/src/vision-text.ts'])evidence.sources[file]=createHash('sha256').update(await readFile(file)).digest('hex');
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');if(url.pathname==='/'){res.setHeader('content-type','text/html');res.end('<!doctype html><title>Isolated task transaction check</title>');return;}
 let file=resolve(root,'.'+decodeURIComponent(url.pathname));if(!file.startsWith(root+sep))throw Error('Outside fixture root');
 if(!extname(file))file+='.ts';const extension=extname(file);if(!['.ts','.js','.json'].includes(extension))throw Error('Unsupported fixture resource');
 const source=await readFile(file,'utf8');res.setHeader('cache-control','no-store');res.setHeader('content-type',extension==='.json'?'application/json':'text/javascript');res.end(extension==='.ts'?stripTypeScriptTypes(source):source);
 }catch(e){res.statusCode=404;res.end(String(e));}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
try{browser=await chromium.launch({channel:'chrome',headless:true});const p=await browser.newPage();await p.goto('http://127.0.0.1:'+server.address().port+'/');
 evidence.result=await p.evaluate(async()=>{
  const {KnowledgeStore,projectNote}=await import('/design/prototype/src/knowledge-store.ts');
  const {prepareOriginal}=await import('/design/prototype/src/original-assets.ts');
  const {makePdfText}=await import('/design/prototype/src/pdf-text.ts');
  const {makeOcrText}=await import('/design/prototype/src/ocr-text.ts');
  const {imageSizing}=await import('/design/prototype/src/ocr-raster.ts');
  const {makeTranscript}=await import('/design/prototype/src/speech-transcript.ts');
  const {makeVisionText}=await import('/design/prototype/src/vision-text.ts');
  const {visionManifest}=await import('/design/prototype/src/vision-assets.ts');
  const assert=(v,m)=>{if(!v)throw Error(m);},same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),results=[];
  for(const kind of ['PDF','OCR','Transcript','Vision']){
   const store=new KnowledgeStore('qa-media-conflict-'+crypto.randomUUID());await store.initialize([]);
   const asset=await prepareOriginal(new File([kind==='PDF'?'%PDF-fixture':'controlled bytes'],kind==='PDF'?'source.pdf':(kind==='OCR'||kind==='Vision')?'source.png':'source.wav',{type:kind==='PDF'?'application/pdf':(kind==='OCR'||kind==='Vision')?'image/png':'audio/wav'}));
   const value=kind==='PDF'?makePdfText(asset,1,[{page:1,text:'Public PDF fixture',regions:[]}]):kind==='OCR'?makeOcrText(asset,'eng',imageSizing(100,100),'Public OCR fixture',[]):kind==='Vision'?makeVisionText(asset,{model:visionManifest.id,revision:visionManifest.revision,runtime:visionManifest.runtime,prompt:'Describe',text:'Public image fixture',width:100,height:100}):makeTranscript(asset,1000,{text:'Public audio fixture',chunks:[{text:'Public audio fixture',timestamp:[0,1]}]});
   const save=(id,fresh)=>kind==='PDF'?store.savePdfText(id,value,fresh?asset:undefined):kind==='OCR'?store.saveOcrText(id,value,fresh?asset:undefined):kind==='Vision'?store.saveVisionText(id,value,fresh?asset:undefined):store.saveTranscript(id,value,fresh?asset:undefined);
   const derived=crypto.randomUUID();await save(derived,true);
   async function refused(work,expected){const before=await store.snapshot();let message='';try{await work();}catch(e){message=e.message;}assert(message===expected,kind+' expected '+expected+', got '+message);assert(same(await store.snapshot(),before),kind+' rejected save changed data');return message;}
   const duplicate=await refused(()=>save(derived,false),kind==='Transcript'?'Transcript already saved':kind==='Vision'?'Vision note already saved':kind+' text already saved');
   const original=await refused(()=>save(crypto.randomUUID(),true),'Original already exists');
   const views=(await store.all()).filter(n=>n.state==='active').map(projectNote);await store.commit(views,views.filter(n=>n.id!==asset.id));
   const withdrawn=await refused(()=>save(crypto.randomUUID(),false),'Original withdrawn');
   results.push({kind,duplicate,original,withdrawn,allRejectedSavesAtomic:true});
   (await store.open()).close();
  }
  return results;
 });evidence.pass=true;
}catch(e){evidence.pass=false;evidence.error=String(e);process.exitCode=1;}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));await writeFile(out+'/evidence.json',JSON.stringify(evidence,null,2));console.log(evidence);}
