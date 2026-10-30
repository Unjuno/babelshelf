import {expect,test} from '@playwright/test';
test('official MCP client and local read-only adapter interoperate offline in the browser',async({page,context})=>{
 await page.goto('/tests/mcp-browser-fixture.html');await expect(page.locator('#root')).toHaveText('ready');
 await context.setOffline(true);
 try{const value=await page.evaluate(()=>(window as any).mcpBrowserFixture());
  expect(value.names).toEqual(['math.calculate']);expect(JSON.parse(value.result.content[0].text)).toEqual({result:42});
 }finally{await context.setOffline(false);}
});
