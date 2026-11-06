import test from 'node:test';
import assert from 'node:assert/strict';
import {uninstallInstalledPwa} from '../scripts/qa/installed-pwa-uninstall.mjs';

test('uninstalls the QA PWA through its isolated Chrome profile and closes resources',async()=>{
 const calls=[];
 const context={
  pages:()=>[],
  newPage:async()=>({}),
  browser:()=>({newBrowserCDPSession:async()=>({send:async(method,params)=>calls.push(['send',method,params]),detach:async()=>calls.push(['detach'])})}),
  close:async()=>calls.push(['close'])
 };
 const browserType={launchPersistentContext:async(path,options)=>{calls.push(['launch',path,options]);return context;}};
 const result=await uninstallInstalledPwa({browserType,profileDir:'C:/temp/isolated-profile',manifestId:'http://127.0.0.1:4180/',channel:'chrome'});
 assert.deepEqual(result,{uninstalled:true});
 assert.deepEqual(calls,[
  ['launch','C:/temp/isolated-profile',{channel:'chrome',headless:true}],
  ['send','PWA.uninstall',{manifestId:'http://127.0.0.1:4180/'}],
  ['detach'],['close']
 ]);
});

test('closes the CDP session and profile even when uninstall fails',async()=>{
 const calls=[];
 const context={pages:()=>[{}],browser:()=>({newBrowserCDPSession:async()=>({send:async()=>{throw Error('uninstall failed');},detach:async()=>calls.push('detach')})}),close:async()=>calls.push('close')};
 await assert.rejects(uninstallInstalledPwa({browserType:{launchPersistentContext:async()=>context},profileDir:'C:/temp/isolated-profile',manifestId:'http://127.0.0.1:4180/'}),/uninstall failed/);
 assert.deepEqual(calls,['detach','close']);
});

test('requires an isolated profile and manifest id before launching Chrome',async()=>{
 let launched=false;
 const browserType={launchPersistentContext:async()=>{launched=true;}};
 await assert.rejects(uninstallInstalledPwa({browserType,profileDir:'',manifestId:'https://app.example/'}),/profile path/);
 await assert.rejects(uninstallInstalledPwa({browserType,profileDir:'C:/temp/p',manifestId:''}),/manifest id/);
 assert.equal(launched,false);
});
