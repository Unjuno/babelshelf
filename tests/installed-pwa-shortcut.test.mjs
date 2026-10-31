import test from 'node:test';
import assert from 'node:assert/strict';
import {belongsToInstalledPwaProfile,removeOwnedInstalledPwaShortcut} from '../scripts/qa/installed-pwa-shortcut.mjs';

const profile='C:\\Users\\tester\\AppData\\Local\\Temp\\babelshelf-installed-pwa-123-profile';
const link={path:'C:\\Users\\tester\\Desktop\\Memory.lnk',target:'C:\\tools\\chrome_proxy.exe',arguments:` --user-data-dir="${profile}" --profile-directory=Default --app-id=abc`};

test('matches both historical and current app names only for the exact owned Chrome profile',()=>{
 assert.equal(belongsToInstalledPwaProfile(link,profile),true);
 assert.equal(belongsToInstalledPwaProfile({...link,path:'C:\\Users\\tester\\Desktop\\BabelShelf (1).lnk'},profile),true);
 assert.equal(belongsToInstalledPwaProfile({...link,arguments:link.arguments.replace('123-profile','123-profile-old')},profile),false);
 assert.equal(belongsToInstalledPwaProfile({...link,target:'C:\\tools\\chrome.exe'},profile),false);
 assert.equal(belongsToInstalledPwaProfile({...link,arguments:' --profile-directory=Default'},profile),false);
 assert.equal(belongsToInstalledPwaProfile(link,'relative-profile'),false);
});

test('Windows cleanup unlinks exact owned shortcut files for both historical and current app names',async()=>{
 const removed=[],scriptResult=JSON.stringify([link,{...link,path:'C:\\Users\\tester\\Desktop\\BabelShelf.lnk'},{...link,path:'C:\\Users\\tester\\Desktop\\Memory (1).lnk',arguments:link.arguments.replace('123-profile','another-profile')}]);
 const result=await removeOwnedInstalledPwaShortcut(profile,{platform:'win32',run:(command,args,options)=>{assert.equal(command,'powershell.exe');assert.equal(options.encoding,'utf8');assert.match(args[3],/BabelShelf\|Memory/);return scriptResult;},stat:async path=>({isFile:()=>true,isSymbolicLink:()=>false,path}),remove:async path=>removed.push(path)});
 assert.deepEqual(result,{removed:2});assert.deepEqual(removed,[link.path,'C:\\Users\\tester\\Desktop\\BabelShelf.lnk']);
});

test('Windows cleanup also removes only dead shortcuts to UUID-named QA temp profiles',async()=>{
 const tempDirectory='C:\\Users\\tester\\AppData\\Local\\Temp',orphanProfile=`${tempDirectory}\\babelshelf-installed-pwa-01234567-89ab-4def-8123-456789abcdef-profile`,liveProfile=`${tempDirectory}\\babelshelf-installed-pwa-11234567-89ab-4def-8123-456789abcdef-profile`;
 const stale={...link,path:'C:\\Users\\tester\\Desktop\\Memory (stale).lnk',arguments:link.arguments.replace(profile,orphanProfile)};
 const live={...link,path:'C:\\Users\\tester\\Desktop\\BabelShelf (live).lnk',arguments:link.arguments.replace(profile,liveProfile)};
 const unrelated={...stale,path:'C:\\Users\\tester\\Desktop\\Memory (personal).lnk',arguments:stale.arguments.replace(orphanProfile,'C:\\Users\\tester\\AppData\\Local\\Chrome\\User Data')};
 const removed=[];
 const result=await removeOwnedInstalledPwaShortcut(profile,{platform:'win32',tempDirectory,profileExists:async path=>path===liveProfile,run:()=>JSON.stringify([stale,live,unrelated]),stat:async path=>({isFile:()=>true,isSymbolicLink:()=>false,path}),remove:async path=>removed.push(path)});
 assert.deepEqual(result,{removed:1});assert.deepEqual(removed,[stale.path]);
});

test('non-Windows cleanup does not invoke shell or remove paths',async()=>{
 const result=await removeOwnedInstalledPwaShortcut(profile,{platform:'linux',run:()=>{throw Error('must not run');},remove:()=>{throw Error('must not remove');}});
 assert.deepEqual(result,{removed:0,reason:'not-windows'});
});
