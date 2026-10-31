import {chromium} from '../../design/prototype/node_modules/playwright-core/index.mjs';

// PWA.install registers an OS-level app (and on Windows, a desktop shortcut).
// Always uninstall while the isolated profile still exists, including when a
// QA phase fails before its evidence verifier can run.
export async function uninstallInstalledPwa({browserType=chromium,profileDir,manifestId,channel='chrome'}={}){
 if(typeof profileDir!=='string'||!profileDir)throw Error('Installed PWA cleanup requires its isolated profile path');
 if(typeof manifestId!=='string'||!manifestId)throw Error('Installed PWA cleanup requires its manifest id');
 const context=await browserType.launchPersistentContext(profileDir,{channel,headless:true});
 try{
  const session=await context.browser().newBrowserCDPSession();
  try{await session.send('PWA.uninstall',{manifestId});}
  finally{await session.detach();}
 }finally{await context.close();}
 return {uninstalled:true};
}
