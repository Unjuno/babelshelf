import {expect,test} from '@playwright/test';

test('reports a missing worker module as startup failure',async({page,context})=>{
 await context.route('**/src/custom-tool-worker.ts*',route=>route.abort('failed'));
 const error=await page.evaluate(async()=>{
  try{await (window as any).customToolFixture.run({code:'() => 42',input:{},capabilities:[]});return 'unexpected success';}
  catch(error){return String((error as Error).message);}
 });
 expect(error).toMatch(/runtime could not start/i);
});

test('reports failed interpreter startup promptly without blaming package code',async({page,context})=>{
 // Let the development server finish discovering the worker dependencies
 // before intercepting its WASM fetch. Otherwise Vite's dependency reload can
 // navigate this fixture during the operation being measured.
 await expect.poll(async()=>{try{return await page.evaluate(async()=>(window as any).customToolFixture.run({code:'() => 42',input:{},capabilities:[]}));}catch(error){if(!String(error).includes('Execution context was destroyed'))throw error;return null;}},{timeout:10000}).toBe(42);
 await context.route(/\.wasm(?:\?|$)/,route=>route.abort('failed'));
 const result=await page.evaluate(async()=>{
  const start=performance.now();
  try{await (window as any).customToolFixture.run({code:'() => 42',input:{},capabilities:[]});return {error:'unexpected success',elapsed:performance.now()-start};}
  catch(error){return {error:String((error as Error).message),elapsed:performance.now()-start};}
 });
 expect(result.error).toMatch(/runtime could not start/i);
 expect(result.elapsed).toBeLessThan(5000);
});

test.beforeEach(async({page})=>{await page.goto('/tests/custom-tool-runtime-fixture.html');await expect(page.locator('#root')).toHaveText('ready');});

test('a reviewed trial discards its real runtime result if paired source changes during a Memory read',async({page})=>{
 const outcome=await page.evaluate(async()=>{
  const {testCustomTool}=await import('/src/custom-tool-test.ts');
  const {createCustomToolPackageFiles}=await import('/src/custom-tool-package.ts');
  const sources=createCustomToolPackageFiles({id:'user.trial',title:'Trial',instructions:'Read one file.',code:'({input,capabilities})=>capabilities.memoryRead(input.query)',capabilities:['memory.read']}).map((source,index)=>({...source,id:'s'+index,version:1}));
  let current=sources,reads=0;
  try{await testCustomTool({sources,input:'{"query":"example.md"}',loadSources:async()=>current,ensureRuntime:async()=>{},host:{check(){},search:async()=>[],resolve:async()=>{reads++;current=sources.map(source=>({...source,version:2}));return [{id:'note',path:'Home/example.md',version:1,body:'example'}];}}});return {error:'unexpected success',reads};}
  catch(error){return {error:(error as Error).message,reads};}
 });
 expect(outcome).toEqual({error:'Tool files changed · close and reopen the test',reads:1});
});

test('executes custom JavaScript inside QuickJS without browser network, storage, worker or process globals',async({page})=>{
 const result=await page.evaluate(async()=>await (window as any).customToolFixture.run({code:'({input}) => ({answer:input.value * 2, fetch:typeof fetch, XMLHttpRequest:typeof XMLHttpRequest, WebSocket:typeof WebSocket, Worker:typeof Worker, importScripts:typeof importScripts, navigator:typeof navigator, caches:typeof caches, crypto:typeof crypto, document:typeof document, window:typeof window, indexedDB:typeof indexedDB, localStorage:typeof localStorage, location:typeof location, process:typeof process, require:typeof require})',input:{value:21},capabilities:[]}));
 expect(result).toEqual({answer:42,fetch:'undefined',XMLHttpRequest:'undefined',WebSocket:'undefined',Worker:'undefined',importScripts:'undefined',navigator:'undefined',caches:'undefined',crypto:'undefined',document:'undefined',window:'undefined',indexedDB:'undefined',localStorage:'undefined',location:'undefined',process:'undefined',require:'undefined'});
});

test('does not expose private content included in a custom tool exception',async({page})=>{
 const error=await page.evaluate(async()=>{
  try{
   await (window as any).customToolFixture.run({code:'({input}) => { throw new Error(input.privateExcerpt); }',input:{privateExcerpt:'PRIVATE_NOTE_EXCERPT'},capabilities:[]});
   return '';
  }catch(caught){return String((caught as Error).message);}
 });
 expect(error).toBe('Custom tool failed · inspect package source and selected capabilities');
 expect(error).not.toContain('PRIVATE_NOTE_EXCERPT');
});

test('brokers declared local-memory reads through the host and returns bounded data',async({page})=>{
 const result=await page.evaluate(async()=>await (window as any).customToolFixture.run({code:'({input,capabilities}) => ({notes:capabilities.memorySearch(input.query)})',input:{query:'rain'},capabilities:['memory.search'],host:{search:async(query:string)=>[{id:'note-1',path:`Notes/${query}.md`,version:2,body:'Bring a coat'}]}}));
 expect(result).toEqual({notes:[{id:'note-1',path:'Notes/rain.md',version:2,body:'Bring a coat'}]});
});

test('a slow local Memory capability does not consume the custom code CPU budget',async({page})=>{
 const result=await page.evaluate(async()=>{
  const skill='---\n{"id":"user.lookup","version":1,"title":"Lookup","inputSchema":{"type":"object","required":["query"],"additionalProperties":false,"properties":{"query":{"type":"string","minLength":1,"maxLength":80}}},"capabilities":["memory.search"]}\n---\nSearch local notes.';
  return (window as any).customToolFixture.agentRegistered([{path:'Tools/user.lookup/SKILL.md',body:skill},{path:'Tools/user.lookup/tool.js',body:'({input,capabilities}) => ({notes:capabilities.memorySearch(input.query)})'}],1300);
 });
 expect(result.final).toEqual({evidence:{notes:[{id:'meeting-1',path:'Notes/meeting.md',version:2,body:'Monday at 10'}]}});
 expect(result.calls).toEqual([{tool:'user.lookup',arguments:{query:'meeting'},result:{notes:[{id:'meeting-1',path:'Notes/meeting.md',version:2,body:'Monday at 10'}]}}]);
 expect(result.planSteps).toBe(2);
});

test('brokers declared arithmetic through the registered local calculator only',async({page})=>{
 const result=await page.evaluate(async()=>await (window as any).customToolFixture.run({code:'({input,capabilities}) => ({result:capabilities.calculate(input.expression)})',input:{expression:'6 * 7'},capabilities:['math.calculate'],host:{calculate:(expression:string)=>42}}));
 expect(result).toEqual({result:42});
});

test('custom packages can browse bounded Memory folder metadata without reading file bodies',async({page})=>{
 const result=await page.evaluate(async()=>await (window as any).customToolFixture.run({
  code:'({input,capabilities}) => capabilities.memoryList(input.path,0,10)',input:{path:'Notes'},capabilities:['memory.list'],
  host:{list:async(path:string,offset:number,limit:number)=>({path,offset,limit,entries:[{kind:'file',name:'meeting.md',path:'Notes/meeting.md',id:'note-1',version:2}],total:1,hasMore:false,nextOffset:null})}
 }));
 expect(result).toEqual({path:'Notes',offset:0,limit:10,entries:[{kind:'file',name:'meeting.md',path:'Notes/meeting.md',id:'note-1',version:2}],total:1,hasMore:false,nextOffset:null});
});

test('host Memory failures expose a fixed message to package code, not exception content',async({page})=>{
 const result=await page.evaluate(async()=>await (window as any).customToolFixture.run({code:'({capabilities}) => { try { capabilities.memorySearch("secret-query"); } catch (error) { return error.message; } return "unexpected"; }',input:{},capabilities:['memory.search'],host:{search:async()=>{throw Error('PRIVATE_PATH_AND_QUERY');}}}));
 expect(result).toBe('Memory capability failed');
 expect(String(result)).not.toContain('PRIVATE_PATH_AND_QUERY');
});

test('stops a custom tool after its bounded local-memory call budget',async({page})=>{
 const result=await page.evaluate(async()=>{
  let calls=0,error='';
  try{await (window as any).customToolFixture.run({code:'({capabilities}) => { for(let i=0;i<9;i++) capabilities.memorySearch("note"); return "done"; }',input:{},capabilities:['memory.search'],host:{search:async()=>{calls++;return [{id:'n1'}];}}});}
  catch(caught){error=String((caught as Error).message);}
  return {calls,error};
 });
 expect(result.calls).toBe(8);
 expect(result.error).toMatch(/capability call limit/i);
});

test('Stop aborts pending local-memory work and terminates the custom worker',async({page})=>{
 const result=await page.evaluate(async()=>{
  const controller=new AbortController();let hostAborted=false,markStarted!:()=>void;
  const started=new Promise<void>(resolve=>{markStarted=resolve;});
  const pending=(window as any).customToolFixture.run({code:'({capabilities}) => capabilities.memorySearch("wait")',input:{},capabilities:['memory.search'],signal:controller.signal,host:{search:async(_query:string,signal:AbortSignal)=>{markStarted();return new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>{hostAborted=signal.aborted;reject(Error('Stopped'));},{once:true}));}}});
  await Promise.race([started,new Promise((_,reject)=>setTimeout(()=>reject(Error('Memory callback did not start')),5000))]);
  controller.abort();
  try{await pending;return {error:'unexpected success',hostAborted};}catch(error){return {error:String((error as Error).message),hostAborted};}
 });
 expect(result.error).toMatch(/Stopped/);
 expect(result.hostAborted).toBe(true);
});

test('the memory store aborts its active IndexedDB read when the tool is stopped',async({page})=>{
 const result=await page.evaluate(()=> (window as any).customToolFixture.cancelDatabaseRead());
 expect(result).toEqual({aborted:true,error:'Stopped'});
});

test('inspects, registers and executes a custom package through the same registry contract',async({page})=>{
 const result=await page.evaluate(async()=>{
  const skill='---\n{"id":"user.lookup","version":1,"title":"Lookup","inputSchema":{"type":"object","required":["query"],"additionalProperties":false,"properties":{"query":{"type":"string","minLength":1,"maxLength":80}}},"capabilities":["memory.search"]}\n---\nSearch notes.';
  return (window as any).customToolFixture.registered([{path:'Tools/user.lookup/SKILL.md',body:skill},{path:'Tools/user.lookup/tool.js',body:'({input,capabilities})=>capabilities.memorySearch(input.query)'}],{query:'meeting'},{check(){},search:async(query:string)=>[{id:'n1',path:`Notes/${query}.md`,version:3,body:'Monday'}],resolve:async()=>{throw Error('undeclared read called');}});
 });
 expect(result).toEqual({result:[{id:'n1',path:'Notes/meeting.md',version:3,body:'Monday'}],allowed:['user.lookup']});
});

test('a selected custom package runs through the bounded agent loop and returns local evidence to its next plan',async({page})=>{
 const result=await page.evaluate(async()=>{
  const skill='---\n{"id":"user.lookup","version":1,"title":"Lookup","inputSchema":{"type":"object","required":["query"],"additionalProperties":false,"properties":{"query":{"type":"string","minLength":1,"maxLength":80}}},"capabilities":["memory.search"]}\n---\nSearch local notes.';
  return (window as any).customToolFixture.agentRegistered([{path:'Tools/user.lookup/SKILL.md',body:skill},{path:'Tools/user.lookup/tool.js',body:'({input,capabilities})=>capabilities.memorySearch(input.query)'}]);
 });
 expect(result.final).toEqual({evidence:[{id:'meeting-1',path:'Notes/meeting.md',version:2,body:'Monday at 10'}]});
 expect(result.calls).toEqual([{tool:'user.lookup',arguments:{query:'meeting'},result:[{id:'meeting-1',path:'Notes/meeting.md',version:2,body:'Monday at 10'}]}]);
 expect(result.planSteps).toBe(2);
});

test('an oversized real custom-tool result records a failure then recovers with a narrower execution',async({page})=>{
 const result=await page.evaluate(async()=>{
  const skill='---\n{"id":"user.lookup","version":1,"title":"Lookup","inputSchema":{"type":"object","required":["length"],"additionalProperties":false,"properties":{"length":{"type":"integer","minimum":1,"maximum":10000}}},"capabilities":[]}\n---\nReturn a bounded sample.';
  return (window as any).customToolFixture.agentRecoversOverflow([{path:'Tools/user.lookup/SKILL.md',body:skill},{path:'Tools/user.lookup/tool.js',body:'({input})=>({body:"x".repeat(input.length)})'}]);
 });
 expect(result.final).toEqual({bodyLength:1000});expect(result.planSteps).toBe(3);expect(result.executions).toBe(2);
 expect(result.attempts).toEqual([
  {tool:'user.lookup',arguments:{length:9000},result:null,error:{code:'result_too_large'}},
  {tool:'user.lookup',arguments:{length:1000},result:{body:'x'.repeat(1000)}},
 ]);
 expect(result.activityStatuses).toEqual([{status:'failed',code:'result_too_large'},{status:'succeeded'}]);
});

test('a runaway loop is hard-stopped in its disposable worker while the app remains responsive',async({page})=>{
 await page.evaluate(()=>{(window as any).timerSignal=false;setTimeout(()=>{(window as any).timerSignal=true;},30);});
 const error=await page.evaluate(async()=>{try{await (window as any).customToolFixture.run({code:'() => { while (true) {} }',input:{},capabilities:[],timeoutMs:100});return '';}catch(error){return String((error as Error).message);}});
 expect(error).toMatch(/time limit/i);expect(await page.evaluate(()=>({timer:(window as any).timerSignal,ready:document.querySelector('#root')?.textContent}))).toEqual({timer:true,ready:'ready'});
});

test('rejects oversized output and does not retry failed user code',async({page})=>{
 const result=await page.evaluate(async()=>{let attempts=0;try{await (window as any).customToolFixture.run({code:'() => "x".repeat(9000)',input:{},capabilities:[]});return 'unexpected success';}catch(error){attempts++;return `${attempts}:${(error as Error).message}`;}});
 expect(result).toMatch(/^1:Custom tool result exceeds its size limit/);
});

test('enforces the QuickJS memory ceiling on allocation-heavy source',async({page})=>{
 const error=await page.evaluate(async()=>{try{await (window as any).customToolFixture.run({code:'() => new Array(1000000).fill(1)',input:{},capabilities:[],timeoutMs:1000,memoryLimitBytes:1024*1024});return '';}catch(error){return String((error as Error).message);}});
 expect(error).toMatch(/memory limit/i);
});
