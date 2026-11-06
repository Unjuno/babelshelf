import type {Page} from '@playwright/test';

/** Prepare the installed app shell with the product's explicit Online opt-in. */
export async function prepareOfflineShell(page:Page){
 await page.getByRole('button',{name:/Offline · Tap to switch Online/}).click();
 await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);
 await page.getByRole('button',{name:/Online · Tap to switch Offline/}).click();
 // Click only starts the async settings write. Do not cut connectivity or
 // reload until the persisted Offline state is reflected and unlocked.
 await page.getByRole('button',{name:/Offline · Tap to switch Online/}).waitFor({state:'visible'});
 await page.waitForFunction(()=>{const button=document.querySelector<HTMLButtonElement>('button[aria-label^="Offline · Tap to switch Online"]');return !!button&&!button.disabled;});
}
