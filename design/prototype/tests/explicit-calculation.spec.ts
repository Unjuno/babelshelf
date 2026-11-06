import {expect,test} from '@playwright/test';
import {prepareOfflineShell} from './pwa-offline-setup.ts';

test('explicit calculator wording keeps parentheses offline without a model',async({page,context})=>{
 await page.goto('/');await prepareOfflineShell(page);
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
  expect(receipt.some(value=>Array.isArray(value)&&value[0]?.expression===expression&&value[0]?.result===String(result)&&value[0]?.precision==='decimal'&&value[0]?.rounded===false)).toBe(true);
  await dialog.getByRole('button',{name:'Close',exact:true}).click();
 }
 for(const [question,result] of [['0.1 + 0.2','0.3'],['1 / 3','≈ 0.333333333333333333']] as const){
  await page.getByRole('textbox',{name:'Message',exact:true}).fill(question);await page.getByRole('button',{name:'Send',exact:true}).click();
  await expect(page.locator('.sent-message').last().locator('.reply-text')).toContainText(result);
 }
 await page.getByRole('textbox',{name:'Message',exact:true}).fill('1 / 0');await page.getByRole('button',{name:'Send',exact:true}).click();
 const failed=page.locator('.sent-message').last();await expect(failed).toContainText('Cannot divide by zero');await expect(failed.locator('.reply-text')).toHaveCount(0);
 await expect(page.getByRole('textbox',{name:'Message',exact:true})).toHaveValue('1 / 0');
});
