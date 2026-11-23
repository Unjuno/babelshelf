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
   {id:'secret-quokka',path:'Inbox/secret-quokka.md',body:'The secret word is QUOKKA.',version:1},
   {id:'secret-blueberry',path:'Inbox/secret-blueberry.md',body:'The secret word is BLUEBERRY.',version:1},
  ]},'granite-embedding-97m-multilingual-r2-onnx');
  const signal=new AbortController().signal;let lastProgress='';
  const events=(_type:string,value:unknown)=>{const next=typeof value==='string'?value:JSON.stringify(value);if(next!==lastProgress){lastProgress=next;void (window as any).reportSemanticProgress(next);}};
  try{
   await runtime.prepareRuntime(true,signal,events);
   await runtime.prepareModel(true,[],signal,events);
   const loaded=await runtime.load(signal,events);
   const indexed=await runtime.index(signal,events);
   const serialize=(hits:Awaited<ReturnType<typeof runtime.search>>)=>hits.map(hit=>({noteId:hit.noteId,path:hit.path,quote:hit.quote,score:hit.score}));
   const paraphraseRuns=[],conflictRuns=[];
   for(let attempt=0;attempt<4;attempt++){
    paraphraseRuns.push(serialize(await runtime.search('会議の集合場所は駅のどの入口ですか？',12,signal,events)));
    conflictRuns.push(serialize(await runtime.search('What is the secret word?',12,signal,events)));
   }
   return {loaded,indexed,paraphraseRuns,conflictRuns};
  }finally{await runtime.close();}
 },`/assets/${runtimeAsset}`);
 expect(result.loaded).toMatchObject({model:'granite-embedding-97m-multilingual-r2-onnx',device:'wasm'});
 expect(result.indexed.sources).toBe(4);
 expect(result.paraphraseRuns).toHaveLength(4);
 for(const hits of result.paraphraseRuns){expect(hits[0]?.noteId).toBe('meeting-location');expect(hits[0]?.quote).toContain('north entrance');}
 expect(result.paraphraseRuns.slice(1)).toEqual([result.paraphraseRuns[0],result.paraphraseRuns[0],result.paraphraseRuns[0]]);
 expect(result.conflictRuns).toHaveLength(4);
 for(const hits of result.conflictRuns){expect(hits.map(hit=>hit.noteId)).toContain('secret-quokka');expect(hits.map(hit=>hit.noteId)).toContain('secret-blueberry');}
 expect(result.conflictRuns.slice(1)).toEqual([result.conflictRuns[0],result.conflictRuns[0],result.conflictRuns[0]]);
});
