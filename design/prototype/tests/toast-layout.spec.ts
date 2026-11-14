import {expect,test} from '@playwright/test';

test('bottom toast leaves the last Help action readable when scrolled to the end',async({page})=>{
 test.setTimeout(60_000);
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Schedule',exact:true}).click();
 await page.getByRole('button',{name:'New schedule'}).click();
 const prompt='QA long toast prompt that should wrap across a narrow phone screen and occupy more than one line';
 await page.getByRole('textbox',{name:'Schedule prompt'}).fill(prompt);
 await page.getByRole('button',{name:'Save',exact:true}).click();
 const title=prompt.slice(0,72);
 await page.getByRole('button',{name:`Schedule actions for ${title}`}).click();
 await page.getByRole('button',{name:'Delete schedule'}).click();
 await page.getByRole('dialog',{name:'Delete?'}).getByRole('button',{name:'Delete',exact:true}).click();
 const toast=page.locator('.preview-toast');await expect(toast).toContainText('Deleted · '+title);await expect(toast.getByRole('button',{name:'Undo'})).toBeVisible();
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings',exact:true}).click();
 await page.getByRole('button',{name:'Help',exact:true}).click();
 await page.getByText('Backup & recovery',{exact:true}).click();
 await page.getByRole('button',{name:'Open Developer →'}).waitFor();
 const geometry=await page.evaluate(()=>{
  const scroll=document.querySelector<HTMLElement>('.mobile-scroll');
  const action=document.querySelector<HTMLElement>('.help-page > details:last-of-type button');
  const toast=document.querySelector<HTMLElement>('.preview-toast');
  if(!scroll||!action||!toast)throw Error('Help content or toast is missing');
  scroll.scrollTop=scroll.scrollHeight;
  const actionRect=action.getBoundingClientRect(),toastRect=toast.getBoundingClientRect();
  return {actionBottom:actionRect.bottom,toastTop:toastRect.top,scrollTop:scroll.scrollTop,maxScroll:scroll.scrollHeight-scroll.clientHeight};
 });
 expect(geometry.actionBottom,`The last Help action is obscured by the toast: ${JSON.stringify(geometry)}`).toBeLessThanOrEqual(geometry.toastTop-4);
});
