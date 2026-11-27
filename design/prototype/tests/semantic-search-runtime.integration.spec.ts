import {expect,test} from '@playwright/test';
import {readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const assetDirectory=fileURLToPath(new URL('../dist/app/assets/',import.meta.url));
const runtimeAsset=readdirSync(assetDirectory).find(name=>/^semantic-search-runtime-.*\.js$/.test(name));
if(!runtimeAsset)throw Error('Built semantic Search runtime asset is missing · build the app first');

const enabled=process.env.BABELSHELF_RUN_SEMANTIC_INTEGRATION==='1';

test.afterEach(async({page},testInfo)=>{
 if(testInfo.status===testInfo.expectedStatus)return;
 try{await testInfo.attach('semantic-search-failure.png',{body:await page.screenshot(),contentType:'image/png'});}catch{}
 try{await testInfo.attach('semantic-search-failure.txt',{body:await page.locator('body').innerText(),contentType:'text/plain'});}catch{}
});

test('pinned multilingual Search model indexes saved notes and retrieves a Japanese paraphrase',async({page})=>{
 test.skip(!enabled,'Explicit opt-in: downloads about 124 MB of pinned Search weights plus its local runtime in an isolated browser profile.');
 test.setTimeout(20*60_000);
 page.setDefaultTimeout(15_000);
 page.setDefaultNavigationTimeout(30_000);
 page.on('console',message=>console.log(`Browser ${message.type()} · ${message.text()}`));
 page.on('pageerror',error=>console.log(`Browser page error · ${error.stack??error.message}`));
 const stage=(label:string)=>console.log(`Search UI integration · ${label}`);
 stage('navigate to app');
 await page.goto('/');
 stage('open Settings');
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings',exact:true}).click();
 await page.getByRole('button',{name:'Connection',exact:true}).click();
 await page.getByRole('button',{name:'Online',exact:true}).click();
 await page.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;});
 await page.reload();
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller,{timeout:30000});

 // Persist a fixed corpus through the real Memory UI. The later assertions
 // exercise the selected model through Memory search, not only its worker API.
 stage('create fixed corpus in Memory');
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Memory',exact:true}).click();
 for(const [name,body] of [
  ['meeting-location.md','Meeting logistics: everyone will convene beside the north entrance of the main railway station.'],
  ['lunch-menu.md','The lunch menu includes noodles, green tea and seasonal fruit.'],
  ['secret-quokka.md','The secret word is QUOKKA.'],
  ['secret-blueberry.md','The secret word is BLUEBERRY.'],
 ] as const){
  stage(`open New file for ${name}`);
  await page.getByRole('button',{name:'New file'}).click();
  stage(`fill New file for ${name}`);
  await page.getByRole('textbox',{name:'File name',exact:true}).fill(name);
  await page.getByRole('textbox',{name:'New file content',exact:true}).fill(body);
  stage(`save New file ${name}`);
  await page.getByRole('dialog',{name:'New file'}).getByRole('button',{name:'Save',exact:true}).click();
  await page.getByRole('dialog',{name:'New file'}).waitFor({state:'hidden'});
  if(name!=='secret-blueberry.md'){
   stage(`return to Inbox after saving ${name}`);
   await page.getByRole('navigation',{name:'Memory path'}).getByRole('button',{name:'Home',exact:true}).click();
   await page.getByRole('button',{name:'Open Inbox',exact:true}).click();
  }
 }
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings',exact:true}).click();
 await page.getByRole('button',{name:'Models',exact:true}).click();
 const searchSettings=page.locator('[data-model-role="search"]');
 await searchSettings.getByRole('combobox',{name:'Search model'}).selectOption('granite-embedding-97m-multilingual-r2-onnx');
 await page.exposeFunction('reportSemanticProgress',(value:string)=>console.log('Search integration · '+value));
 stage('run real-model runtime and deterministic search repetitions');
 const result=await page.evaluate(async(runtimeUrl)=>{
  const {createSemanticSearchRuntime}=await import(runtimeUrl);
  const runtime=createSemanticSearchRuntime({views:async()=>[
   {id:'meeting-location',path:'Inbox/meeting-location.md',body:'Meeting logistics: everyone will convene beside the north entrance of the main railway station.',version:1},
   {id:'lunch-menu',path:'Inbox/lunch-menu.md',body:'The lunch menu includes noodles, green tea and seasonal fruit.',version:1},
   {id:'secret-quokka',path:'Inbox/secret-quokka.md',body:'The secret word is QUOKKA.',version:1},
   {id:'secret-blueberry',path:'Inbox/secret-blueberry.md',body:'The secret word is BLUEBERRY.',version:1},
  ]},'granite-embedding-97m-multilingual-r2-onnx');
  const signal=new AbortController().signal;let lastProgress='';
  const events=(_type:string,value:unknown)=>{
   const next=typeof value==='string'?value:JSON.stringify(value),percentage=next.match(/(\d{1,3})%/);
   const progressKey=percentage?`${next.replace(/\s+·\s+\d{1,3}%.*$/,'')}:${Math.floor(Number(percentage[1])/25)}`:next;
   if(progressKey!==lastProgress){lastProgress=progressKey;void (window as any).reportSemanticProgress(next);}
  };
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
 console.log('Search integration · fixed-corpus result vectors · '+JSON.stringify({paraphrase:result.paraphraseRuns[0],conflict:result.conflictRuns[0]}));
 expect(result.loaded).toMatchObject({model:'granite-embedding-97m-multilingual-r2-onnx',device:'wasm'});
 expect(result.indexed.sources).toBe(4);
 expect(result.paraphraseRuns).toHaveLength(4);
 for(const hits of result.paraphraseRuns){expect(hits.map(hit=>hit.noteId)).toEqual(['meeting-location']);expect(hits[0]?.quote).toContain('north entrance');}
 expect(result.paraphraseRuns.slice(1)).toEqual([result.paraphraseRuns[0],result.paraphraseRuns[0],result.paraphraseRuns[0]]);
 expect(result.conflictRuns).toHaveLength(4);
 for(const hits of result.conflictRuns){expect(hits.map(hit=>hit.noteId)).toEqual(['secret-quokka','secret-blueberry']);}
 expect(result.conflictRuns.slice(1)).toEqual([result.conflictRuns[0],result.conflictRuns[0],result.conflictRuns[0]]);

 // Exercise the actual Settings controls and Memory UI Search ON/OFF path with
 // the same downloaded model. Search OFF must keep keyword behavior; it cannot
 // return semantic-only matches after the setting is removed.
 stage('exercise Settings runtime verification, load, and indexing controls');
 await searchSettings.getByRole('button',{name:'Check runtime',exact:true}).click();
 await expect(searchSettings.locator('.model-preparation')).toContainText('Runtime ready');
 await searchSettings.getByRole('button',{name:'Check files',exact:true}).click();
 await expect(searchSettings.locator('.model-preparation')).toContainText('Files verified');
 await searchSettings.getByRole('button',{name:'Load',exact:true}).click();
 await expect(searchSettings.locator('.model-preparation')).toContainText('Model loaded',{timeout:120_000});
 await searchSettings.getByRole('button',{name:'Build index',exact:true}).click();
 await expect(searchSettings.getByRole('status',{name:'Semantic index status'})).toContainText('4 current notes');
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Memory',exact:true}).click();
 stage('assert semantic Memory UI result');
 const memorySearch=page.getByRole('textbox',{name:'Find files or text'});
 await memorySearch.fill('会議の集合場所は駅のどの入口ですか？');
 const semanticResult=page.getByRole('button',{name:/Inbox\/meeting-location\.md/});
 await expect(semanticResult).toContainText('Meaning match');
 await expect(semanticResult).toContainText('north entrance');
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings',exact:true}).click();
 await page.getByRole('button',{name:'Models',exact:true}).click();
 await page.locator('[data-model-role="search"]').getByRole('button',{name:'Turn off',exact:true}).click();
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Memory',exact:true}).click();
 stage('assert keyword-only result after Search is disabled');
 await page.getByRole('textbox',{name:'Find files or text'}).fill('会議の集合場所は駅のどの入口ですか？');
 await expect(page.locator('.empty-state')).toContainText('No files');
 await expect(page.getByText('Meaning match')).toHaveCount(0);
});
