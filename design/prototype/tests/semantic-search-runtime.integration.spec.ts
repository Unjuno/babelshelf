import {expect,test} from '@playwright/test';
import {readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const assetDirectory=fileURLToPath(new URL('../dist/app/assets/',import.meta.url));
const runtimeAsset=readdirSync(assetDirectory).find(name=>/^semantic-search-runtime-.*\.js$/.test(name));
if(!runtimeAsset)throw Error('Built semantic Search runtime asset is missing · build the app first');

const enabled=process.env.BABELSHELF_RUN_SEMANTIC_INTEGRATION==='1';

test('pinned multilingual Search model indexes saved notes and retrieves a Japanese paraphrase',async({page})=>{
 test.skip(!enabled,'Explicit opt-in: downloads about 124 MB of pinned Search weights plus its local runtime in an isolated browser profile.');
 test.setTimeout(20*60_000);
 await page.goto('/');
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings',exact:true}).click();
 await page.getByRole('button',{name:'Connection',exact:true}).click();
 await page.getByRole('button',{name:'Online',exact:true}).click();
 await page.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;});
 await page.reload();
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller,{timeout:30000});
 await page.exposeFunction('reportSemanticProgress',(value:string)=>console.log('Search integration · '+value));
 const result=await page.evaluate(async(runtimeUrl)=>{
  const {createSemanticSearchRuntime}=await import(runtimeUrl);
  const runtime=createSemanticSearchRuntime({views:async()=>[
   {id:'meeting-location',path:'Inbox/meeting-location.md',body:'Meeting logistics: everyone will convene beside the north entrance of the main railway station.',version:1},
   {id:'lunch-menu',path:'Inbox/lunch-menu.md',body:'The lunch menu includes noodles, green tea and seasonal fruit.',version:1},
  ]},'granite-embedding-97m-multilingual-r2-onnx');
  const signal=new AbortController().signal,events=(_type:string,value:unknown)=>{void (window as any).reportSemanticProgress(typeof value==='string'?value:JSON.stringify(value));};
  try{
   await runtime.prepareRuntime(true,signal,events);
   await runtime.prepareModel(true,[],signal,events);
   const loaded=await runtime.load(signal,events);
   const indexed=await runtime.index(signal,events);
   const hits=await runtime.search('会議の集合場所は駅のどの入口ですか？',12,signal,events);
   return {loaded,indexed,hits:hits.map(hit=>({noteId:hit.noteId,path:hit.path,quote:hit.quote,score:hit.score}))};
  }finally{await runtime.close();}
 },`/assets/${runtimeAsset}`);
 expect(result.loaded).toMatchObject({model:'granite-embedding-97m-multilingual-r2-onnx',device:'wasm'});
 expect(result.indexed.sources).toBe(2);
 expect(result.hits[0]?.noteId).toBe('meeting-location');
 expect(result.hits[0]?.quote).toContain('north entrance');
});
