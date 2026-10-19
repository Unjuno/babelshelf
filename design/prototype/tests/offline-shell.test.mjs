import test from 'node:test';
import assert from 'node:assert/strict';
import {observeOfflineRegistration,activateWaitingUpdate} from '../src/offline-shell.ts';
class Worker extends EventTarget {constructor(state){super();this.state=state;}set(state){this.state=state;this.dispatchEvent(new Event('statechange'));}}
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
