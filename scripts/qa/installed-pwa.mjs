import {chromium} from '../../design/prototype/node_modules/playwright-core/index.mjs';
import {createDevServer} from '../serve.mjs';
import {runOfflineProcessCheck} from './offline-process.mjs';
import {rm,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';

const [profileArg,outputArg]=process.argv.slice(2),runId=randomUUID();
const ownsProfile=!profileArg;
const profileDir=profileArg??join(tmpdir(),`babelshelf-installed-pwa-${runId}-profile`);
const outputDir=outputArg??join(tmpdir(),`babelshelf-installed-pwa-${runId}-results`);
const server=createDevServer('design/prototype/dist/app');
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const url='http://127.0.0.1:'+server.address().port+'/';
let stopped=false,primaryError;
try{
 const result=await runOfflineProcessCheck(chromium,{profileDir,outputDir,url,channel:'chromium',installedPwa:true,afterBootstrap:async()=>{await new Promise(resolve=>server.close(resolve));stopped=true;}});
 result.fixtureServerStopped=stopped;
 if(!stopped)throw Error('PWA fixture server was not stopped');
 await writeFile(join(outputDir,'installed-evidence.json'),JSON.stringify(result,null,2));
 execFileSync(process.execPath,['scripts/qa/verify-installed-pwa.mjs',outputDir],{stdio:'inherit'});
 console.log({pass:result.pass,fixtureServerStopped:stopped,build:result.phases[0].build.build,profileDir:ownsProfile?'temporary (removed on exit)':profileDir,outputDir});
}catch(error){
 primaryError=error;
 throw error;
}finally{
 let cleanupError;
 if(server.listening)try{await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}catch(error){cleanupError=error;}
 if(ownsProfile)try{await rm(profileDir,{recursive:true,force:true});}catch(error){cleanupError??=error;}
 if(cleanupError){
  if(primaryError)console.error('QA cleanup also failed:',cleanupError);
  else throw cleanupError;
 }
}
