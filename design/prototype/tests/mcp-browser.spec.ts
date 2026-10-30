import {expect,test} from '@playwright/test';
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
