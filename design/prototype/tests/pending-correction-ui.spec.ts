import {expect,test,type Page} from '@playwright/test';

async function assistant(page:Page){
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings',exact:true}).click();
 await page.getByText('More',{exact:true}).click();
 await page.getByRole('button',{name:'Assistant',exact:true}).click();
}
async function propose(page:Page){
 await page.goto('/');await assistant(page);
 await page.getByRole('button',{name:'Harness profile',exact:true}).click();
 await page.getByRole('button',{name:'Source first',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Review changes',exact:true})).toBeVisible();
}

test('unapproved review survives dismissal and restart; Save applies once and removes it',async({page})=>{
 await propose(page);await page.keyboard.press('Escape');
 await page.reload();
 await expect(page.getByRole('button',{name:'Review pending changes',exact:true})).toBeVisible();
 await assistant(page);
 await expect(page.getByRole('button',{name:'Harness profile',exact:true})).toHaveText('Standard');
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('button',{name:'Review pending changes',exact:true}).click();
 await expect(page.getByRole('region',{name:'Profile before',exact:true})).toContainText('Standard');
 await expect(page.getByRole('region',{name:'Profile after',exact:true})).toContainText('Source first');
 await page.getByRole('button',{name:'Save',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Review changes',exact:true})).toHaveCount(0);
 await page.reload();
 await expect(page.getByRole('button',{name:'Review pending changes',exact:true})).toHaveCount(0);
 await assistant(page);
 await expect(page.getByRole('button',{name:'Harness profile',exact:true})).toHaveText('Source first');
});

test('explicit Cancel removes the pending proposal without changing the original settings',async({page})=>{
 await propose(page);await page.reload();
 await page.getByRole('button',{name:'Review pending changes',exact:true}).click();
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Review changes',exact:true})).toHaveCount(0);
 await page.reload();
 await expect(page.getByRole('button',{name:'Review pending changes',exact:true})).toHaveCount(0);
 await assistant(page);
 await expect(page.getByRole('button',{name:'Harness profile',exact:true})).toHaveText('Standard');
});

test('a pending review blocks a new correction before model preparation and keeps its exact review across reload',async({page})=>{
 await propose(page);await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('textbox',{name:'Message',exact:true}).fill('read: Settings/harness.md');await page.getByRole('button',{name:'Send',exact:true}).click();await expect(page.getByRole('button',{name:'History',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('button',{name:'Input',exact:true}).click();
 const request='Set max calls to 2.';await page.getByRole('textbox',{name:'Message',exact:true}).fill(request);await page.getByRole('button',{name:'Send',exact:true}).click();
 await expect(page.locator('.sent-message').last()).toContainText('Review pending changes first');
 await expect(page.getByRole('textbox',{name:'Message',exact:true})).toHaveValue(request);
 await expect(page.getByText('Model not prepared',{exact:true})).toHaveCount(0);
 await page.reload();await page.getByRole('button',{name:'Review pending changes',exact:true}).click();
 await expect(page.getByRole('region',{name:'Profile before',exact:true})).toContainText('Standard');await expect(page.getByRole('region',{name:'Profile after',exact:true})).toContainText('Source first');
 await page.getByRole('button',{name:'Cancel',exact:true}).click();await assistant(page);await expect(page.getByRole('button',{name:'Harness profile',exact:true})).toHaveText('Standard');
});

test('a saved change in another tab invalidates a resumed review without overwriting it',async({page,context})=>{
 await propose(page);
 const other=await context.newPage();await other.goto('/');await assistant(other);
 await other.getByRole('button',{name:'Concise',exact:true}).click();
 await expect(other.getByRole('button',{name:'Concise',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.reload();await page.getByRole('button',{name:'Review pending changes',exact:true}).click();
 await expect(page.getByRole('button',{name:'Save',exact:true})).toBeDisabled();
 await expect(page.getByRole('alert')).toContainText(/changed|conflict/i);
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.reload();await assistant(page);
 await expect(page.getByRole('button',{name:'Harness profile',exact:true})).toHaveText('Standard');
 await expect(page.getByRole('button',{name:'Concise',exact:true})).toHaveAttribute('aria-pressed','true');
});

test('an old review cannot approve or discard a different proposal created by another tab',async({page,context})=>{
 await propose(page);
 const other=await context.newPage();await other.goto('/');
 await other.getByRole('button',{name:'Review pending changes',exact:true}).click();
 await other.getByRole('button',{name:'Cancel',exact:true}).click();
 await assistant(other);await other.getByRole('button',{name:'Harness profile',exact:true}).click();
 await other.getByRole('button',{name:'Conversation',exact:true}).click();
 await expect(other.getByRole('heading',{name:'Review changes',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Save',exact:true}).click();
 await expect(page.getByRole('button',{name:'Save',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('button',{name:'Review pending changes',exact:true}).click();
 await expect(page.getByRole('region',{name:'Profile after',exact:true})).toContainText('Conversation');
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
});

for(const theme of ['Dark','Light'])test(`history request text is readable in ${theme} appearance`,async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('menuitem',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Appearance',exact:true}).click();await page.getByRole('group',{name:'Theme',exact:true}).getByRole('button',{name:theme,exact:true}).click();await page.getByRole('button',{name:'Back to Settings',exact:true}).click();await page.getByText('More',{exact:true}).click();await page.getByRole('button',{name:'Assistant',exact:true}).click();await page.getByRole('button',{name:'Harness profile',exact:true}).click();await page.getByRole('button',{name:'Source first',exact:true}).click();await page.getByRole('button',{name:'Save',exact:true}).click();await page.getByRole('button',{name:'Edit harness file',exact:true}).click();await page.getByRole('button',{name:'History',exact:true}).click();
 const request=page.locator('.version-list .trash-item small');await expect(request).toContainText('Use profile: Source first');
 const contrast=await request.evaluate(element=>{
  const channels=(value:string)=>value.match(/[\d.]+/g)!.slice(0,3).map(Number);
  const lum=(rgb:number[])=>rgb.map(n=>n/255).map(n=>n<=0.04045?n/12.92:((n+0.055)/1.055)**2.4).reduce((sum,n,i)=>sum+n*[0.2126,0.7152,0.0722][i],0);
  let background='rgb(255,255,255)';for(let parent:Element|null=element;parent;parent=parent.parentElement){const color=getComputedStyle(parent).backgroundColor,parts=color.match(/[\d.]+/g)?.map(Number);if(parts&&(parts.length<4||parts[3]>=0.99)){background=color;break;}}const a=lum(channels(getComputedStyle(element).color)),b=lum(channels(background));return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
 });expect(contrast).toBeGreaterThanOrEqual(4.5);
});
