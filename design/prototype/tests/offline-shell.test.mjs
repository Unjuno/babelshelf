import test from 'node:test';
import assert from 'node:assert/strict';
import {observeOfflineRegistration,activateWaitingUpdate,activeAppBuild,enforceOfflineNetwork} from '../src/offline-shell.ts';
import {refreshAppVersion,appUpdateOutcome} from '../src/offline-shell.ts';
class Worker extends EventTarget {constructor(state){super();this.state=state;}set(state){this.state=state;this.dispatchEvent(new Event('statechange'));}}

test('Refresh returns a retryable error when the browser update check never settles',async()=>{
 let release,activations=0;const worker=new Worker('installed');worker.postMessage=()=>activations++;
 const registration={waiting:worker,update:()=>new Promise(resolve=>{release=resolve;})};
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
