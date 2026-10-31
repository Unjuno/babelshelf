import test from 'node:test';
import assert from 'node:assert/strict';
import {parseInstalledPwaArguments,shouldRemoveInstalledPwaOutput,shouldRemoveInstalledPwaProfile} from '../scripts/qa/installed-pwa-profile-policy.mjs';
import {shouldRemoveGeneratedOfflineQaPath} from '../scripts/qa/offline-process.mjs';
import {runOfflineProcessCheck} from '../scripts/qa/offline-process.mjs';
import {connectQaProcessSignals} from '../scripts/qa/process-signals.mjs';
import {EventEmitter} from 'node:events';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('installed-PWA profiles are ephemeral by default, including caller-named fresh paths',()=>{
 assert.deepEqual(parseInstalledPwaArguments([]),{profileArg:undefined,outputArg:undefined,retainProfile:false});
 assert.deepEqual(parseInstalledPwaArguments(['C:/temp/fresh-profile','C:/temp/evidence']),{profileArg:'C:/temp/fresh-profile',outputArg:'C:/temp/evidence',retainProfile:false});
 assert.equal(shouldRemoveInstalledPwaProfile({profileWasAbsentBeforeRun:true,retainProfile:false}),true);
});

test('retention is explicit and only applies to a caller-named profile',()=>{
 assert.deepEqual(parseInstalledPwaArguments(['C:/temp/fresh-profile','C:/temp/evidence','--retain-profile']),{profileArg:'C:/temp/fresh-profile',outputArg:'C:/temp/evidence',retainProfile:true});
 assert.throws(()=>parseInstalledPwaArguments(['--retain-profile']),/requires an explicit new profile path/);
 assert.throws(()=>parseInstalledPwaArguments(['C:/temp/profile','--unknown']),/Unknown installed-PWA option/);
 assert.equal(shouldRemoveInstalledPwaProfile({profileWasAbsentBeforeRun:true,retainProfile:true}),false);
 assert.equal(shouldRemoveInstalledPwaProfile({profileWasAbsentBeforeRun:false,retainProfile:false}),false);
});

test('generated installed-PWA evidence is temporary unless the caller names an output path',()=>{
 assert.equal(shouldRemoveInstalledPwaOutput({outputWasGenerated:true}),true);
 assert.equal(shouldRemoveInstalledPwaOutput({outputWasGenerated:false}),false);
});

test('offline-process QA removes only paths it generated itself',()=>{
 assert.equal(shouldRemoveGeneratedOfflineQaPath({generated:true}),true);
 assert.equal(shouldRemoveGeneratedOfflineQaPath({generated:false}),false);
});

test('graceful process interruption aborts the QA run and removes installed signal listeners',()=>{
 const processLike=new EventEmitter(),connection=connectQaProcessSignals(processLike);
 processLike.emit('SIGINT');assert.equal(connection.signal.aborted,true);assert.match(connection.signal.reason.message,/SIGINT/);
 connection.dispose();assert.equal(processLike.listenerCount('SIGINT'),0);assert.equal(processLike.listenerCount('SIGTERM'),0);
});

test('an interrupted offline QA closes its active browser context before unwinding',async()=>{
 const base=await mkdtemp(join(tmpdir(),'babelshelf-signal-cleanup-test-')),outputDir=join(base,'evidence'),controller=new AbortController();let closes=0;
 const contextEvents=new EventEmitter(),browserEvents=new EventEmitter(),browserType={name:()=> 'chromium',launchPersistentContext:async()=>({on:contextEvents.on.bind(contextEvents),browser:()=>({on:browserEvents.on.bind(browserEvents)}),pages:()=>[],setOffline:async()=>controller.abort(Error('test interrupt')),setDefaultTimeout:()=>{},newPage:async()=>{throw Error('context closed');},close:async()=>{closes++;}})};
 try{
  await assert.rejects(runOfflineProcessCheck(browserType,{profileDir:join(base,'profile'),outputDir,url:'http://127.0.0.1:1/',signal:controller.signal}),/test interrupt|context closed/);
  assert.ok(closes>=1,'Active context must close in its phase cleanup');assert.equal(controller.signal.aborted,true);
 }finally{await rm(base,{recursive:true,force:true});}
});
