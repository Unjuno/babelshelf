import {expect,test} from '@playwright/test';

test('explicit calculator wording keeps parentheses offline without a model',async({page,context})=>{
 await page.goto('/');await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);
 await context.setOffline(true);await page.reload();
 for(const [question,expression,result] of [
  ['Use the calculator to work out (84 + 16) / 5, and give just the result.','(84 + 16) / 5',20],
  ['Please compute (6 + 4) / 2, return only the answer.','(6 + 4) / 2',5],
  ['Evaluate −2 × (3 + 4).','−2 × (3 + 4)',-14],
 ] as const){
  await page.getByRole('textbox',{name:'Message',exact:true}).fill(question);
  await page.getByRole('button',{name:'Send',exact:true}).click();
  const row=page.locator('.sent-message').last();
  await expect(row).toContainText(expression+' = '+result);
  await expect(row.getByText('Calculated',{exact:true})).toBeVisible();
  await row.getByRole('button',{name:'View activity',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Activity',exact:true});
  await expect(dialog.locator('details')).toHaveCount(1);
  await dialog.locator('summary').click();
  const receipt=(await dialog.locator('pre').allTextContents()).map(text=>JSON.parse(text));
  expect(receipt.some(value=>value.expression===expression&&value.package==='math.calculate')).toBe(true);
  expect(receipt.some(value=>Array.isArray(value)&&value[0]?.expression===expression&&value[0]?.result===result)).toBe(true);
  await dialog.getByRole('button',{name:'Close',exact:true}).click();
 }
});
