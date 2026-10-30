import test from 'node:test';
import assert from 'node:assert/strict';
import {createCustomToolPackageFiles,inspectCustomToolPackage} from '../src/custom-tool-package.ts';
import {customToolRegistration} from '../src/custom-tool-adapter.ts';

test('custom tools receive the local clock only when declared',async()=>{
 for(const enabled of [false,true]){
  const files=createCustomToolPackageFiles({id:'user.clock',title:'Clock',instructions:'Read the device clock.',code:'({capabilities}) => capabilities.timeNow()',capabilities:enabled?['time.now']:[]});
  const pkg=await inspectCustomToolPackage(files);let observed;
  const registered=await customToolRegistration(pkg,async options=>{observed=options;return options.host.now?options.host.now():null;});
  const result=await registered.run({query:'now'},{check(){},search:async()=>[],resolve:async()=>[]});
  assert.equal(typeof observed.host.now,enabled?'function':'undefined');
  if(enabled){assert.equal(result.source,'device-clock');assert.ok(Number.isFinite(Date.parse(result.instant)));}else assert.equal(result,null);
 }
});

test('QuickJS receives only the declared clock capability',async()=>{
 const {spawnSync}=await import('node:child_process'),workerUrl=new URL('../src/custom-tool-worker.ts',import.meta.url).href;
 const script=`let done;globalThis.postMessage=m=>{if(m.type==='capability')setTimeout(()=>globalThis.onmessage({data:{type:'capability-result',requestId:m.requestId,value:{source:'device-clock'}}}),0);if(m.type==='result'||m.type==='error')done(m)};
 await import(${JSON.stringify(workerUrl)});
 async function run(code,capabilities){const wait=new Promise(resolve=>done=resolve);globalThis.onmessage({data:{type:'run',code,input:{},capabilities,timeoutMs:750,memoryLimitBytes:8388608}});return await wait;}
 const yes=await run('({capabilities})=>capabilities.timeNow()',['time.now']);if(yes.type!=='result'||yes.value.source!=='device-clock')throw Error('clock bridge failed');
 const no=await run('({capabilities})=>typeof capabilities.timeNow',[]);if(no.type!=='result'||no.value!=='undefined')throw Error('undeclared clock exposed');`;
 const child=spawnSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8',timeout:10000});assert.equal(child.status,0,child.stderr||child.stdout);
});
