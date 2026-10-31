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

test('Windows cleanup scans Desktop and localized Chrome Apps Start Menu entries',async()=>{
 const removed=[],scriptResult=JSON.stringify([link,{...link,path:'C:\\Users\\tester\\Desktop\\BabelShelf.lnk'},{...link,path:'C:\\Users\\tester\\Desktop\\Memory (1).lnk',arguments:link.arguments.replace('123-profile','another-profile')}]);
 const result=await removeOwnedInstalledPwaShortcut(profile,{platform:'win32',run:(command,args,options)=>{assert.equal(command,'powershell.exe');assert.equal(options.encoding,'utf8');assert.match(args[3],/BabelShelf\|Memory/);assert.match(args[3],/GetFolderPath\("StartMenu"\)/);assert.match(args[3],/Chrome\|Chromium/);return scriptResult;},stat:async path=>({isFile:()=>true,isSymbolicLink:()=>false,path}),remove:async path=>removed.push(path)});
 assert.deepEqual(result,{removed:2});assert.deepEqual(removed,[link.path,'C:\\Users\\tester\\Desktop\\BabelShelf.lnk']);
});

test('historical BabelShelf Temp and unit-test app links are removed without touching browser profiles',async()=>{
 const tempDirectory='C:\\Users\\tester\\AppData\\Local\\Temp',documentsCodex='C:\\Users\\tester\\Documents\\Codex';
 const qaProfiles=[`${tempDirectory}\\BabelShelf-lfm230-ac228037cebb433599a2df158440bd76`,`${tempDirectory}\\babelshelf-installed-pwa-01234567-89ab-4def-8123-456789abcdef-profile`,`${documentsCodex}\\pwa-installed-unit129b`];
 const links=qaProfiles.map((path,index)=>({...link,path:`C:\\Users\\tester\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Chrome Apps\\Memory (${index}).lnk`,arguments:link.arguments.replace(profile,path)}));
 const personal={...link,path:'C:\\Users\\tester\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Chrome Apps\\Memory - Personal.lnk',arguments:link.arguments.replace(profile,'C:\\Users\\tester\\AppData\\Local\\Google\\Chrome\\User Data')};
 const removed=[],profileChecks=[];
 const result=await removeOwnedInstalledPwaShortcut('C:\\Users\\tester\\AppData\\Local\\Temp\\active-profile',{platform:'win32',tempDirectory,documentsCodex,run:()=>JSON.stringify([...links,personal]),profileExists:async path=>{profileChecks.push(path);return false;},stat:async path=>({isFile:()=>true,isSymbolicLink:()=>false,path}),remove:async path=>removed.push(path)});
 assert.deepEqual(result,{removed:3});assert.deepEqual(removed,links.map(item=>item.path));assert.deepEqual(profileChecks,[qaProfiles[1]]);
});

test('Windows cleanup also removes only dead shortcuts to UUID-named QA temp profiles',async()=>{
 const tempDirectory='C:\\Users\\tester\\AppData\\Local\\Temp',orphanProfile=`${tempDirectory}\\babelshelf-installed-pwa-01234567-89ab-4def-8123-456789abcdef-profile`;
 const stale={...link,path:'C:\\Users\\tester\\Desktop\\Memory (stale).lnk',arguments:link.arguments.replace(profile,orphanProfile)};
 const personalProfile='C:\\Users\\tester\\AppData\\Local\\Google\\Chrome\\User Data';
 const live={...link,path:'C:\\Users\\tester\\Desktop\\BabelShelf (live).lnk',arguments:link.arguments.replace(profile,personalProfile)};
 const unrelated={...stale,path:'C:\\Users\\tester\\Desktop\\Memory (personal).lnk',arguments:stale.arguments.replace(orphanProfile,personalProfile)};
 const removed=[];
 const result=await removeOwnedInstalledPwaShortcut(profile,{platform:'win32',tempDirectory,profileExists:async path=>path!==orphanProfile,run:()=>JSON.stringify([stale,live,unrelated]),stat:async path=>({isFile:()=>true,isSymbolicLink:()=>false,path}),remove:async path=>removed.push(path)});
 assert.deepEqual(result,{removed:1});assert.deepEqual(removed,[stale.path]);
});

test('non-Windows cleanup does not invoke shell or remove paths',async()=>{
 const result=await removeOwnedInstalledPwaShortcut(profile,{platform:'linux',run:()=>{throw Error('must not run');},remove:()=>{throw Error('must not remove');}});
 assert.deepEqual(result,{removed:0,reason:'not-windows'});
});
