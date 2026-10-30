import {expect,test} from '@playwright/test';
test('paged Memory search runs in a browser worker and keeps exact source ranges',async({page})=>{
 await page.goto('/tests/mcp-browser-fixture.html');await expect(page.locator('#root')).toHaveText('ready');
 const result=await page.evaluate(async()=>{
  const {KnowledgeStore}=await import('/src/knowledge-store.ts');
  const name='search-worker-browser-'+crypto.randomUUID(),store=new KnowledgeStore(name),originalWorker=window.Worker;let created=0;
  window.Worker=class extends originalWorker{constructor(url:string|URL,options?:WorkerOptions){super(url,options);created++;}};
  try{
   const seeds=Array.from({length:15},(_,i)=>({id:`water-${i}`,path:`Inbox/${i<14?'travel':'travelling'}/water-${i}.md`,body:`water reserve ${i}`,version:1,history:[]}));
   await store.initialize(seeds);const first=await store.searchPage('water',{offset:0,limit:12}),second=await store.searchPage('water',{offset:first.nextOffset!,limit:12,snapshot:first.snapshot});
   const scoped=await store.searchPage('water',{offset:0,limit:12,pathPrefix:'Inbox/travel'}),scopedNext=await store.searchPage('water',{offset:12,limit:12,pathPrefix:'Inbox/travel',snapshot:scoped.snapshot});let rejected=false;
   try{await store.searchPage('water',{offset:12,limit:12,pathPrefix:'Inbox/travelling',snapshot:scoped.snapshot});}catch{rejected=true;}
   const rows=await store.all();return {created,first:first.hits.length,second:second.hits.length,exact:second.hits.every((hit:any)=>typeof hit.quote==='string'&&rows.find((note:any)=>note.id===hit.noteId).revisions[hit.revision-1].body.slice(hit.start,hit.end)===hit.quote),scoped:scoped.hits.length+scopedNext.hits.length,inside:[...scoped.hits,...scopedNext.hits].every((hit:any)=>hit.noteId!=='water-14'),rejected};
  }finally{store.close();window.Worker=originalWorker;await new Promise<void>((resolve,reject)=>{const request=indexedDB.deleteDatabase(name);request.onsuccess=()=>resolve();request.onerror=()=>reject(request.error);});}
 });
 expect(result).toEqual({created:1,first:12,second:3,exact:true,scoped:14,inside:true,rejected:true});
});
test('official MCP client and local read-only adapter interoperate offline in the browser',async({page,context})=>{
 await page.goto('/tests/mcp-browser-fixture.html');await expect(page.locator('#root')).toHaveText('ready');
 await context.setOffline(true);
 try{const value=await page.evaluate(()=>(window as any).mcpBrowserFixture());
  expect(value.names).toEqual(['math.calculate']);expect(JSON.parse(value.result.content[0].text)).toEqual({result:42});
 }finally{await context.setOffline(false);}
});
test('the agent executes an audited local tool over MCP with the browser offline',async({page,context})=>{
 await page.goto('/tests/mcp-browser-fixture.html');await expect(page.locator('#root')).toHaveText('ready');await context.setOffline(true);
 try{const value=await page.evaluate(()=>(window as any).mcpAgentFixture());
  expect(value.calls).toHaveLength(1);expect(value.calls[0].tool).toBe('math.calculate');expect(value.calls[0].result[0].result).toBe('42');expect(value.activities).toEqual(['running','succeeded']);
 }finally{await context.setOffline(false);}
});
test('the offline MCP agent searches local IndexedDB with versioned source ranges',async({page,context})=>{
 await page.goto('/tests/mcp-browser-fixture.html');await expect(page.locator('#root')).toHaveText('ready');await context.setOffline(true);
 try{const value=await page.evaluate(()=>(window as any).mcpMemoryFixture());
  expect(value.calls).toHaveLength(1);expect(value.calls[0].tool).toBe('memory.search');
  const source=value.calls[0].result.find((row:any)=>row.noteId==='mcp-source'&&typeof row.quote==='string');
  expect(source).toBeTruthy();expect(source.revision).toBe(1);expect('Water reserve: 17 liters.'.slice(source.start,source.end)).toBe(source.quote);expect(value.activities).toEqual(['running','succeeded']);
 }finally{await context.setOffline(false);}
});
test('offline agent follows saved provenance to the cited original',async({page,context})=>{
 await page.goto('/tests/mcp-browser-fixture.html');await expect(page.locator('#root')).toHaveText('ready');await context.setOffline(true);
 try{const value=await page.evaluate(()=>(window as any).mcpSourcesFixture());
  expect(value.calls.map((call:any)=>call.tool)).toEqual(['memory.sources','memory.read']);expect(value.completed).toEqual(['memory.sources','memory.read']);
  expect(value.refs).toHaveLength(1);expect(value.refs[0].noteId).toBe('source');expect(value.refs[0].revision).toBe(1);expect(value.refs[0].quote).toBe('Water reserve: 17 liters.');
 }finally{await context.setOffline(false);}
});
test('an offline multi-source MCP workflow saves the reviewed text and exact original references',async({page,context})=>{
 await page.goto('/tests/mcp-browser-fixture.html');await expect(page.locator('#root')).toHaveText('ready');await context.setOffline(true);
 try{const value=await page.evaluate(()=>(window as any).mcpComparisonFixture());
  expect(value.calls).toEqual(['memory.search','memory.read','memory.read','memory.read']);expect(value.completed).toEqual(value.calls);
  expect(value.sources.map((source:any)=>source.noteId).sort()).toEqual(['source-0','source-1','source-2']);
  for(const source of value.sources){const text=['Water reserve: 17 liters.','Water reserve: 9 liters.','Water reserve: 24 liters.'][Number(source.noteId.at(-1))];expect(source.revision).toBe(1);expect(text.slice(source.start,source.end)).toBe(source.quote);}
  const pins=value.sources.map(({noteId,revision,start,end,quote}:any)=>({noteId,revision,start,end,quote}));
  expect(value.savedBody).toBe(value.answer);expect(value.savedSources).toEqual(pins);
 }finally{await context.setOffline(false);}
});
test('MCP agent executes a selected custom tool with actual isolated runtime and source tracking',async({page,context})=>{
 await context.route('**/*',route=>{const url=new URL(route.request().url());return ['127.0.0.1','localhost'].includes(url.hostname)?route.continue():route.abort();});
 await page.goto('/tests/mcp-browser-fixture.html');await expect(page.locator('#root')).toHaveText('ready');
 const value=await page.evaluate(()=>(window as any).mcpCustomFixture());
 expect(value.calls).toEqual(['tools.read-skill','user.lookup']);expect(value.source.noteId).toBe('custom-source');expect(value.source.revision).toBe(1);
 expect('Water reserve: 17 liters.'.slice(value.source.start,value.source.end)).toBe(value.source.quote);
 expect(value.completed).toEqual(['tools.read-skill','user.lookup']);
});
test('custom source overflow keeps only previously committed evidence and reports partial work',async({page,context})=>{
 await context.route('**/*',route=>{const url=new URL(route.request().url());return ['127.0.0.1','localhost'].includes(url.hostname)?route.continue():route.abort();});
 await page.goto('/tests/mcp-browser-fixture.html');await expect(page.locator('#root')).toHaveText('ready');
 const value=await page.evaluate(()=>(window as any).mcpCustomOverflowFixture());
 expect(value.reason).toBe('source-capacity');expect(value.partial).toBe(true);expect(value.calls).toEqual(['tools.read-skill','memory.search']);
 expect(value.customEvidence).toEqual([]);expect(value.customStatus).toEqual(['running','failed']);
});
