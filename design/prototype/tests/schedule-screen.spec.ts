import {expect,test} from '@playwright/test';

test('schedule checks do not overlap and can resume after failure',async({page})=>{
 await page.goto('/tests/schedule-screen-fixture.html?phase=poll');
 await expect(page.getByText('Reads started: 1')).toBeVisible();
 await page.getByRole('button',{name:'Trigger poll'}).click();
 await page.getByRole('button',{name:'Trigger poll'}).click();
 await expect(page.getByText('Reads started: 1')).toBeVisible();
 await page.getByRole('button',{name:'Fail read'}).click();
 await expect(page.getByText('Fixture read failed')).toBeVisible();
 await page.getByRole('button',{name:'Trigger poll'}).click();
 await expect(page.getByText('Reads started: 2')).toBeVisible();
 await page.getByRole('button',{name:'Finish read'}).click();
 await expect(page.getByRole('button',{name:'Finish read'})).toBeDisabled();
 await expect(page.getByText('Fixture read failed')).toHaveCount(0);
 await page.getByRole('button',{name:'Trigger poll'}).click();
 await expect(page.getByText('Reads started: 3')).toBeVisible();
});

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
