import {expect,test} from '@playwright/test';

test('Help and license text open offline on a prepared product with enlarged text',async({page,context})=>{
 await page.goto('/');
 await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);
 // First visit to either page happens after going offline and reloading.
 await context.setOffline(true);await page.reload();
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings',exact:true}).click();
 await page.getByRole('button',{name:'Help',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Help',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Open settings file',exact:true})).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'Start here'})).toBeVisible();
 await page.getByText('Schedules & notifications',{exact:true}).click();
 await expect(page.getByText(/Schedules run while the app is open and visible/)).toBeVisible();
 await page.getByText('Offline & updates',{exact:true}).click();
 await page.getByRole('button',{name:'Open Connection →',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Connection',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Offline',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'Back to Settings'}).click();
 await page.getByRole('button',{name:'Licenses',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Licenses',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Open settings file',exact:true})).toHaveCount(0);
 await expect(page.getByText(/no confirmed runtime-specific redistribution license/)).toBeVisible();
 await page.getByRole('textbox',{name:'Find a license'}).fill('react');
 const react=page.locator('.licenses-page details').filter({has:page.locator('summary > span').getByText('react',{exact:true})});
 await react.locator(':scope > summary').click();
 await react.getByText('LICENSE',{exact:true}).click();
 await expect(react.locator('pre')).toContainText('Permission is hereby granted');
 await expect(react.locator('pre')).toContainText('Meta Platforms');
 // Long notices and names must wrap instead of causing horizontal scrolling.
 await page.addStyleTag({content:'html{font-size:200% !important}'});
 expect(await page.locator('.licenses-page').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 await page.getByRole('textbox',{name:'Find a license'}).fill('whisper');
 await page.getByText('whisper-MIT.txt',{exact:true}).click();
 await expect(page.locator('.license-text')).toContainText('Copyright');
 await page.getByRole('button',{name:'Back to Settings'}).click();
 await expect(page.getByRole('button',{name:'Help',exact:true})).toBeVisible();
});
