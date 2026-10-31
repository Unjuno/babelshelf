import {chromium} from '../../design/prototype/node_modules/playwright-core/index.mjs';
import {createDevServer} from '../serve.mjs';
import {runOfflineProcessCheck} from './offline-process.mjs';
import {lstat,rm,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {removeOwnedInstalledPwaShortcut} from './installed-pwa-shortcut.mjs';
import {uninstallInstalledPwa} from './installed-pwa-uninstall.mjs';
import {parseInstalledPwaArguments,shouldRemoveInstalledPwaOutput,shouldRemoveInstalledPwaProfile} from './installed-pwa-profile-policy.mjs';
import {connectQaProcessSignals} from './process-signals.mjs';

const {profileArg,outputArg,retainProfile}=parseInstalledPwaArguments(process.argv.slice(2)),runId=randomUUID();
const profileDir=profileArg??join(tmpdir(),`babelshelf-installed-pwa-${runId}-profile`);
const outputDir=outputArg??join(tmpdir(),`babelshelf-installed-pwa-${runId}-results`);
const outputWasGeneratedBeforeRun=outputArg===undefined;
try{await lstat(profileDir);throw Error('Refusing to reuse an existing QA profile: '+profileDir);}catch(error){if(error?.code!=='ENOENT')throw error;}
try{await lstat(outputDir);throw Error('Refusing to reuse an existing QA output directory: '+outputDir);}catch(error){if(error?.code!=='ENOENT')throw error;}
const profileWasAbsentBeforeRun=true;
const processSignals=connectQaProcessSignals();let server,url,stopped=false,primaryError,pwaInstallAttempted=false;
try{
 server=createDevServer('design/prototype/dist/app');
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 url='http://127.0.0.1:'+server.address().port+'/';
 const result=await runOfflineProcessCheck(chromium,{profileDir,outputDir,url,channel:'chromium',installedPwa:true,onPwaInstallAttempt:()=>{pwaInstallAttempted=true;},signal:processSignals.signal,afterBootstrap:async()=>{await new Promise(resolve=>server.close(resolve));stopped=true;}});
 result.fixtureServerStopped=stopped;
 if(!stopped)throw Error('PWA fixture server was not stopped');
 await writeFile(join(outputDir,'installed-evidence.json'),JSON.stringify(result,null,2));
 execFileSync(process.execPath,['scripts/qa/verify-installed-pwa.mjs',outputDir],{stdio:'inherit'});
 console.log({pass:result.pass,fixtureServerStopped:stopped,build:result.phases[0].build.build,profileDir:shouldRemoveInstalledPwaProfile({profileWasAbsentBeforeRun,retainProfile})?'temporary (removed on exit)':profileDir,outputDir});
}catch(error){
 primaryError=error;
 throw error;
}finally{
 processSignals.dispose();
 let cleanupError;
 if(server?.listening)try{await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}catch(error){cleanupError=error;}
 if(primaryError&&pwaInstallAttempted)try{await lstat(profileDir);await uninstallInstalledPwa({browserType:chromium,profileDir,manifestId:url,channel:'chromium'});}catch(error){if(error?.code!=='ENOENT')cleanupError??=error;}
 try{const cleanup=await removeOwnedInstalledPwaShortcut(profileDir);if(cleanup.removed)console.log(`Removed ${cleanup.removed} QA-owned desktop shortcut(s)`);}catch(error){cleanupError??=error;}
 if(shouldRemoveInstalledPwaProfile({profileWasAbsentBeforeRun,retainProfile}))try{await rm(profileDir,{recursive:true,force:true});}catch(error){cleanupError??=error;}
 if(shouldRemoveInstalledPwaOutput({outputWasGenerated:outputWasGeneratedBeforeRun}))try{await rm(outputDir,{recursive:true,force:true});}catch(error){cleanupError??=error;}
 if(cleanupError){
  if(primaryError)console.error('QA cleanup also failed:',cleanupError);
  else throw cleanupError;
 }
}
