import {expect,test} from '@playwright/test';

test('hides Stop after a schedule run has claimed completion and is saving',async({page})=>{
 await page.goto('/tests/schedule-screen-fixture.html?phase=saving');
 await expect(page.getByRole('status')).toContainText('Saving result…');
 await expect(page.getByRole('button',{name:'Stop scheduled run'})).toHaveCount(0);
});

test('keeps Stop available while scheduled inference is still running',async({page})=>{
 await page.goto('/tests/schedule-screen-fixture.html?phase=running');
 await expect(page.getByRole('status')).toContainText('Running');
 await expect(page.getByRole('button',{name:'Stop scheduled run'})).toBeEnabled();
});
