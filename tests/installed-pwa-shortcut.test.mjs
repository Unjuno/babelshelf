import test from 'node:test';
import assert from 'node:assert/strict';
import {belongsToInstalledPwaProfile,removeOwnedInstalledPwaShortcut} from '../scripts/qa/installed-pwa-shortcut.mjs';

const profile='C:\\Users\\tester\\AppData\\Local\\Temp\\babelshelf-installed-pwa-123-profile';
const link={path:'C:\\Users\\tester\\Desktop\\BabelShelf.lnk',target:'C:\\tools\\chrome_proxy.exe',arguments:` --user-data-dir="${profile}" --profile-directory=Default --app-id=abc`};

test('only matches a BabelShelf Chrome app shortcut with the exact owned profile',()=>{
 assert.equal(belongsToInstalledPwaProfile(link,profile),true);
 assert.equal(belongsToInstalledPwaProfile({...link,arguments:link.arguments.replace('123-profile','123-profile-old')},profile),false);
 assert.equal(belongsToInstalledPwaProfile({...link,target:'C:\\tools\\chrome.exe'},profile),false);
 assert.equal(belongsToInstalledPwaProfile({...link,arguments:' --profile-directory=Default'},profile),false);
 assert.equal(belongsToInstalledPwaProfile(link,'relative-profile'),false);
});

test('Windows cleanup unlinks only exact owned shortcut files',async()=>{
 const removed=[],scriptResult=JSON.stringify([link,{...link,path:'C:\\Users\\tester\\Desktop\\BabelShelf (1).lnk',arguments:link.arguments.replace('123-profile','another-profile')}]);
 const result=await removeOwnedInstalledPwaShortcut(profile,{platform:'win32',run:(command,args,options)=>{assert.equal(command,'powershell.exe');assert.equal(options.encoding,'utf8');return scriptResult;},stat:async path=>({isFile:()=>true,isSymbolicLink:()=>false,path}),remove:async path=>removed.push(path)});
 assert.deepEqual(result,{removed:1});assert.deepEqual(removed,[link.path]);
});

test('non-Windows cleanup does not invoke shell or remove paths',async()=>{
 const result=await removeOwnedInstalledPwaShortcut(profile,{platform:'linux',run:()=>{throw Error('must not run');},remove:()=>{throw Error('must not remove');}});
 assert.deepEqual(result,{removed:0,reason:'not-windows'});
});
