import test from 'node:test';
import assert from 'node:assert/strict';
import {observeOfflineRegistration} from '../src/offline-shell.ts';
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
