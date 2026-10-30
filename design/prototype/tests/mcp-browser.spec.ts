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
