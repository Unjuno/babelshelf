import test from 'node:test';
import assert from 'node:assert/strict';
import {observeOfflineRegistration,activateWaitingUpdate,activeAppBuild,enforceOfflineNetwork,initializeOfflineShell,offlineShellStatus,prepareOfflineAppShell} from '../src/offline-shell.ts';
test('offline shell check distinguishes verified assets, missing files and unsupported workers',async()=>{
 const {checkOfflineAppShell}=await import('../src/offline-shell.ts');
 const worker=status=>({postMessage(message,[port]){assert.equal(message.type,'check-app-shell');port.postMessage({status});}});
 assert.equal(await checkOfflineAppShell(worker('ready'),100),'ready');
 assert.equal(await checkOfflineAppShell(worker('missing'),100),'missing');
 assert.equal(await checkOfflineAppShell({postMessage(){}},5),'unknown');
 assert.equal(await checkOfflineAppShell(null,5),'unknown');
});
test('retrying an app-shell check ignores an older late result and can be cancelled',async()=>{
 const module=await import('../src/offline-shell.ts');assert.equal(typeof module.createOfflineShellHealthProbe,'function');
 const pending=[],states=[],probe=module.createOfflineShellHealthProbe(()=>new Promise(resolve=>pending.push(resolve)),value=>states.push(value));
 const first=probe.check(),second=probe.check();pending[1]('ready');await second;pending[0]('missing');await first;
 assert.deepEqual(states,['checking','checking','ready']);
 const third=probe.check();probe.cancel();pending[2]('missing');await third;assert.deepEqual(states,['checking','checking','ready','checking']);
});
test('explicit app repair requires connectivity, reports failures and cancels on timeout',async()=>{
 const {repairOfflineAppShell}=await import('../src/offline-shell.ts');const messages=[];
 const ready={postMessage(message,ports){messages.push(message);ports?.[0]?.postMessage({status:'ready'});}};
 await repairOfflineAppShell(ready,false,100);assert.equal(messages[0].localOnly,true);messages.length=0;
 const disconnected={postMessage(_message,ports){ports[0].postMessage({status:'disconnected'});}};
 await assert.rejects(repairOfflineAppShell(disconnected,false,100),/Connect/);
 const offline={postMessage(_message,ports){ports[0].postMessage({status:'offline'});}};
 await assert.rejects(repairOfflineAppShell(offline,true,100),/Select Online/);assert.equal(messages.length,0);
 await repairOfflineAppShell(ready,true,100);assert.equal(messages[0].type,'repair-app-shell');
 const stalled={postMessage(message){messages.push(message);}};await assert.rejects(repairOfflineAppShell(stalled,true,5),/timed out/);
 assert.equal(messages.at(-1).type,'cancel-app-shell-repair');assert.equal(messages.at(-1).operationId,messages.at(-2).operationId);
});
import {refreshAppVersion,appUpdateOutcome} from '../src/offline-shell.ts';
class Worker extends EventTarget {constructor(state){super();this.state=state;}set(state){this.state=state;this.dispatchEvent(new Event('statechange'));}}

test('a stale Online lookup cannot register a worker after Offline supersedes it',async()=>{
 let release,lookups=0,registrations=0;
 const container={getRegistration:()=>++lookups===1?new Promise(resolve=>{release=resolve;}):Promise.resolve(undefined),register:async()=>{registrations++;throw Error('must not register');}};
 const stale=initializeOfflineShell(container,true);await initializeOfflineShell(container,false);release(undefined);await stale;
 assert.equal(registrations,0);assert.equal(offlineShellStatus(),'Not prepared');
});

test('offline shell is registered only by an explicit Online choice and reuses an existing registration offline',async()=>{
 const registration=new EventTarget();registration.active=new Worker('activated');let registered=0,current;
 const container={getRegistration:async()=>current,register:async path=>{assert.equal(path,'./sw.js');registered++;current=registration;return registration;}};
 await initializeOfflineShell(container,false);assert.equal(offlineShellStatus(),'Not prepared');assert.equal(registered,0);
 await initializeOfflineShell(container,true);assert.equal(offlineShellStatus(),'Installed');assert.equal(registered,1);
 await initializeOfflineShell(container,false);assert.equal(offlineShellStatus(),'Installed');assert.equal(registered,1);
});

test('offline app-shell preparation requires a live connection and does not change model/download preferences',async()=>{
 let registrations=0;const registration=new EventTarget();registration.active=new Worker('activated');
 const container={getRegistration:async()=>registration,register:async()=>{registrations++;return registration;},ready:Promise.resolve(registration),controller:new Worker('activated')};
 await assert.rejects(prepareOfflineAppShell(container,false),/Connect/);assert.equal(registrations,0);
 await prepareOfflineAppShell(container,true);assert.equal(registrations,0);assert.equal(offlineShellStatus(),'Installed');
});

test('offline shell registration failure returns promptly instead of waiting for serviceWorker.ready',async()=>{
 const container={getRegistration:async()=>undefined,register:async()=>{throw Error('registration refused');},ready:new Promise(()=>{})};
 await assert.rejects(prepareOfflineAppShell(container,true,1000),/App preparation failed/);
 assert.equal(offlineShellStatus(),'Preparation failed');
});

test('Refresh returns a retryable error when the browser update check never settles',async()=>{
 let release,activations=0;const worker=new Worker('installed');worker.postMessage=()=>activations++;
 const registration={waiting:null,update:()=>new Promise(resolve=>{release=resolve;})};
 const result=refreshAppVersion(registration,new EventTarget(),5).then(()=> 'success',error=>error.message);
 assert.match(await Promise.race([result,new Promise(resolve=>setTimeout(()=>resolve('still waiting'),100))]),/Update timed out/);
 release();await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(activations,0,'A late browser response cannot resume the timed-out refresh');
});

test('stalled install wait detaches its listener and a later explicit retry can use the verified worker',async()=>{
 const worker=new Worker('installing');let listeners=0;
 const add=worker.addEventListener.bind(worker),remove=worker.removeEventListener.bind(worker);
 worker.addEventListener=(...args)=>{listeners++;add(...args);};
 worker.removeEventListener=(...args)=>{listeners--;remove(...args);};
 const registration={installing:worker};
 const result=appUpdateOutcome(registration,5).then(()=> 'success',error=>error.message);
 assert.match(await Promise.race([result,new Promise(resolve=>setTimeout(()=>resolve('still waiting'),100))]),/Update timed out/);
 assert.equal(listeners,0);
 registration.waiting=worker;registration.installing=null;worker.set('installed');
 assert.equal(await appUpdateOutcome(registration,5),'Update ready');
});

test('Offline requires controller acknowledgement and never claims enforcement for old or missing workers',async()=>{
 assert.equal(await enforceOfflineNetwork({postMessage(message,[port]){assert.deepEqual(message,{type:'network-offline'});port.postMessage({offline:true});}},100),true);
 assert.equal(await enforceOfflineNetwork({postMessage(message,[port]){port.postMessage({offline:false});}},100),false);
 assert.equal(await enforceOfflineNetwork({postMessage(){}},5),false);
 assert.equal(await enforceOfflineNetwork(null),false);
});
test('failed first app installation is visible and never becomes Installed',()=>{const worker=new Worker('installing'),registration=new EventTarget();registration.installing=worker;const states=[];const stop=observeOfflineRegistration(registration,s=>states.push(s));worker.set('redundant');assert.deepEqual(states,['Installing','Preparation failed']);stop();});
test('activation and existing usable worker are distinct from model readiness',()=>{const worker=new Worker('installing'),registration=new EventTarget();registration.installing=worker;const states=[];const stop=observeOfflineRegistration(registration,s=>states.push(s));registration.active=worker;worker.set('activated');assert.deepEqual(states,['Installing','Installed']);stop();});
test('failed update keeps an existing active app installed and detached observers stay silent',()=>{const worker=new Worker('installing'),registration=new EventTarget();registration.installing=worker;registration.active=new Worker('activated');const states=[];const stop=observeOfflineRegistration(registration,s=>states.push(s));worker.set('redundant');assert.deepEqual(states,['Installed','Installed']);stop();worker.set('activated');assert.equal(states.length,2);});
test('activation handoff never reports preparation failure while the verified worker activates',()=>{
 const worker=new Worker('installed'),registration=new EventTarget();registration.waiting=worker;const states=[];
 const stop=observeOfflineRegistration(registration,s=>states.push(s));
 registration.waiting=null;worker.set('activating');worker.set('activated');
 assert.deepEqual(states,['Installing','Installing','Installed']);stop();
});
test('an empty or redundant registration cannot report a successful app update',async()=>{const {appUpdateOutcome}=await import('../src/offline-shell.ts');await assert.rejects(appUpdateOutcome({}),/App cache not prepared/);await assert.rejects(appUpdateOutcome({installing:new Worker('redundant')}),/Update verification failed/);});
test('app update waits for successful or failed install outcome',async()=>{const {appUpdateOutcome}=await import('../src/offline-shell.ts');const worker=new Worker('installing'),registration={installing:worker};const result=appUpdateOutcome(registration);registration.waiting=worker;worker.set('installed');assert.equal(await result,'Update ready');assert.equal(await appUpdateOutcome({active:new Worker('activated')}),'Up to date');const failed=new Worker('installing'),pending=appUpdateOutcome({installing:failed});failed.set('redundant');await assert.rejects(pending,/Update verification failed/);});

test('Apply update requires a waiting worker and confirmed control of this page',async()=>{
 const container=new EventTarget();container.controller=new Worker('activated');
 await assert.rejects(activateWaitingUpdate({waiting:null},container,20),/no longer ready/);
 const worker=new Worker('installed'),registration={waiting:worker,active:container.controller};
 worker.postMessage=message=>{assert.deepEqual(message,{type:'activate-update'});queueMicrotask(()=>{registration.waiting=null;registration.active=worker;worker.set('activated');container.controller=worker;container.dispatchEvent(new Event('controllerchange'));});};
 await activateWaitingUpdate(registration,container,100);
 assert.equal(container.controller,worker);
});

test('Apply update does not report success if activation fails or never controls the page',async()=>{
 const container=new EventTarget();container.controller=new Worker('activated');
 const failed=new Worker('installed');failed.postMessage=()=>queueMicrotask(()=>failed.set('redundant'));
 await assert.rejects(activateWaitingUpdate({waiting:failed},container,100),/activation failed/);
 const stalled=new Worker('installed');stalled.postMessage=()=>stalled.set('activated');
 await assert.rejects(activateWaitingUpdate({waiting:stalled,active:stalled},container,5),/not confirmed/);
});

test('Refresh app checks once, applies a waiting build, and returns only after the new worker controls the page',async()=>{
 const {refreshAppVersion}=await import('../src/offline-shell.ts');
 const container=new EventTarget();container.controller=new Worker('activated');
 const worker=new Worker('installing'),registration={installing:worker,waiting:null,active:container.controller,update:async()=>{registration.waiting=worker;worker.set('installed');}};
 worker.postMessage=message=>{assert.deepEqual(message,{type:'activate-update'});queueMicrotask(()=>{registration.waiting=null;registration.installing=null;registration.active=worker;worker.set('activated');container.controller=worker;container.dispatchEvent(new Event('controllerchange'));});};
 assert.equal(await refreshAppVersion(registration,container,100),'Updated');assert.equal(container.controller,worker);
});

test('Refresh app verifies an up-to-date active build and still requests an explicit refresh',async()=>{
 const {refreshAppVersion}=await import('../src/offline-shell.ts');let checks=0;const registration={active:new Worker('activated'),waiting:null,installing:null,update:async()=>{checks++;}};
 assert.equal(await refreshAppVersion(registration,new EventTarget(),100),'Up to date');assert.equal(checks,1);
});

test('diagnostics report the controlling worker build without assuming server freshness',async()=>{
 const worker={postMessage:(message,[port])=>{assert.equal(message,'build');port.postMessage({build:'519a5ee2b57a7699'});}};
 assert.equal(await activeAppBuild({controller:worker},100),'519a5ee2b57a7699');
 assert.equal(await activeAppBuild({controller:null},100),'Unavailable');
 assert.equal(await activeAppBuild({controller:{postMessage:()=>{}}},5),'Unknown');
});
