import type {Page} from '@playwright/test';

/** Prepare the installed app shell with the product's explicit Online opt-in. */
export async function prepareOfflineShell(page:Page){
 await page.getByRole('button',{name:/Offline · Tap to switch Online/}).click();
 await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);
 await page.getByRole('button',{name:/Online · Tap to switch Offline/}).click();
}
