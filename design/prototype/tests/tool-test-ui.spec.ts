import {expect,test,type Page} from '@playwright/test';
import {prepareOfflineShell} from './pwa-offline-setup.ts';

async function settings(page:Page,item:string){
 await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('menuitem',{name:'Settings',exact:true}).click();
 const target=page.getByRole('button',{name:item,exact:true});if(!await target.isVisible())await page.getByText('More',{exact:true}).click();await target.click();
}
test('source details can be enabled and retained across reload',async({page})=>{
 await page.goto('/');await settings(page,'Assistant');
 const source=page.getByRole('switch',{name:'Source details',exact:true});await expect(source).not.toBeChecked();await source.click();await expect(source).toBeChecked();
 await expect.poll(()=>page.evaluate(()=>new Promise<boolean>((resolve,reject)=>{const open=indexedDB.open('mlb-memory-v1');open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,read=db.transaction('notes','readonly').objectStore('notes').getAll();read.onerror=()=>{db.close();reject(read.error);};read.onsuccess=()=>{const note=read.result.find((item:any)=>item.id==='settings-harness'),body=note?.revisions?.at(-1)?.body??'';db.close();resolve(body.includes('"memory.sources"'));};};}))).toBe(true);
 await page.reload();await settings(page,'Assistant');await expect(page.getByRole('switch',{name:'Source details',exact:true})).toBeChecked();
});
test('saved tool runs offline after joining the active profile, preserves source and reports real failures',async({page,context})=>{
 await page.goto('/');await prepareOfflineShell(page);
 await settings(page,'Connection');await page.getByRole('button',{name:'Online',exact:true}).click();
 await settings(page,'Tools');await page.getByRole('button',{name:'Prepare runtime',exact:true}).click();
 await expect(page.getByText('Prepared · verified',{exact:true})).toBeVisible();
 await settings(page,'Connection');await page.getByRole('button',{name:'Offline',exact:true}).click();await context.setOffline(true);
 // A first network visit is not isolated. Cached navigation adds COOP/COEP;
 // workers must still start after that reload, with no network fallback.
 await page.reload();
 expect(await page.evaluate(()=>crossOriginIsolated)).toBe(true);
 await settings(page,'Tools');await page.getByRole('button',{name:'Create tool package',exact:true}).click();
 await page.getByRole('textbox',{name:'Tool code',exact:true}).fill('({input})=>({length:input.query.length,network:typeof fetch})');
 await page.getByRole('button',{name:'Save files',exact:true}).click();await expect(page.getByRole('navigation',{name:'Memory path'})).toContainText('user.my-tool');
 await page.getByRole('button',{name:'Test tool',exact:true}).click({timeout:5000});
 await page.getByRole('textbox',{name:'Test input',exact:true}).fill('{"query":"abc"}');await page.getByRole('button',{name:'Run test',exact:true}).click();
 await expect(page.getByRole('region',{name:'Test result',exact:true})).toContainText('"length": 3');
 await expect(page.getByRole('region',{name:'Test result',exact:true})).toContainText('"network": "undefined"');
 await page.getByRole('button',{name:'Close',exact:true}).click();
 await page.getByRole('button',{name:'Test tool',exact:true}).click({timeout:5000});
 await expect(page.getByRole('region',{name:'Test result',exact:true})).toHaveCount(0);
 await page.getByRole('textbox',{name:'Test input',exact:true}).fill('{"query":5}');await page.getByRole('button',{name:'Run test',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('invalid');
 await page.getByRole('button',{name:'Close',exact:true}).click();
 await settings(page,'Assistant');await expect(page.getByRole('button',{name:'Harness profile',exact:true})).toContainText('Standard');await expect(page.locator('section[aria-label="Assistant profile"] .source-revision').first()).toContainText('user.my-tool');
 await settings(page,'Tools');await page.getByRole('button',{name:'Open tool files',exact:true}).click();
 await page.getByRole('button',{name:'Open user.my-tool',exact:true}).click();await page.getByRole('button',{name:'Open tool.js',exact:true}).click();
 await expect(page.locator('.file-footer')).toContainText('v1');
 await page.getByRole('button',{name:'Edit',exact:true}).click();await page.getByRole('textbox',{name:'Markdown content',exact:true}).fill('()=>{while(true){}}');await page.getByRole('button',{name:'Save',exact:true}).click();
 await page.getByRole('button',{name:'Test tool',exact:true}).click({timeout:5000});await page.getByRole('textbox',{name:'Test input',exact:true}).fill('{"query":"abc"}');await page.getByRole('button',{name:'Run test',exact:true}).click();
 await page.getByRole('button',{name:'Stop',exact:true}).click();await expect(page.getByRole('alert')).toHaveText('Stopped');
 await page.getByRole('button',{name:'Run test',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('time limit');
});

test('a saved Memory tool joins the active profile and tests its local calculator capability',async({page})=>{
 await page.goto('/');await prepareOfflineShell(page);
 await settings(page,'Connection');await page.getByRole('button',{name:'Online',exact:true}).click();
 await settings(page,'Tools');await page.getByRole('button',{name:'Prepare runtime',exact:true}).click();
 await expect(page.getByText('Prepared · verified',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Create tool package',exact:true}).click();
 await page.getByRole('textbox',{name:'Tool ID',exact:true}).fill('user.local-calc');
 await page.getByRole('textbox',{name:'Tool title'}).fill('Local calculator');
 await page.getByRole('textbox',{name:'Tool instructions'}).fill('Calculate the supplied arithmetic expression.');
 await page.getByRole('checkbox',{name:'math.calculate'}).check();
 await page.getByRole('textbox',{name:'Tool code',exact:true}).fill('({input,capabilities})=>({answer:capabilities.calculate(input.query)})');
 await page.getByRole('button',{name:'Save files',exact:true}).click();await expect(page.getByRole('navigation',{name:'Memory path'})).toContainText('user.local-calc');
 await page.getByRole('button',{name:'Test tool',exact:true}).click();
 await expect(page.getByText('Local access: math.calculate',{exact:true})).toBeVisible();
 await page.getByRole('textbox',{name:'Test input',exact:true}).fill('{"query":"6 * 7"}');
 await page.getByRole('button',{name:'Run test',exact:true}).click();
 await expect(page.getByRole('region',{name:'Test result',exact:true})).toContainText('"answer": 42');
 await page.getByRole('button',{name:'Close',exact:true}).click();
 await settings(page,'Assistant');await expect(page.getByRole('button',{name:'Harness profile',exact:true})).toContainText('Standard');await expect(page.locator('section[aria-label="Assistant profile"] .source-revision').first()).toContainText('user.local-calc');
});
