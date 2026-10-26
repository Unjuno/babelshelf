import {expect,test,type Page} from '@playwright/test';

for(const action of ['type','offline'] as const)test(`working during app update: ${action} prevents reload`,async({page})=>{
 await page.addInitScript(()=>{
  const registration={active:{state:'activated'},installing:null,waiting:null,addEventListener(){},removeEventListener(){},
   update:()=>new Promise(resolve=>{(window as any).__releaseUpdate=()=>resolve(registration);})};
  Object.defineProperty(navigator.serviceWorker,'getRegistration',{configurable:true,value:async()=>registration});
 });
 await page.goto('/');
 await page.getByRole('button',{name:'Offline · Tap to switch Online'}).click();
 await page.getByRole('button',{name:'Update app'}).click();
 await page.waitForFunction(()=>typeof (window as any).__releaseUpdate==='function');
 const message=page.getByRole('textbox',{name:'Message'});
 if(action==='type')await message.fill('Keep the new draft written during update');
 else {
  await page.getByRole('button',{name:'Online · Tap to switch Offline'}).click();
  await expect(page.getByRole('button',{name:'Offline · Tap to switch Online'})).toBeEnabled();
 }
 await page.evaluate(()=>(window as any).__releaseUpdate());
 await expect(page.getByText('Update checked · save current work, then update again',{exact:true})).toBeVisible();
 if(action==='type')await expect(message).toHaveValue('Keep the new draft written during update');
 else await expect(page.getByRole('button',{name:'Offline · Tap to switch Online'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Update app'})).toBeDisabled();
});

async function openSettingsItem(page:Page,name:string){
 const item=page.getByRole('button',{name,exact:true});
 if(!(await item.isVisible()))await page.locator('.settings-more > summary').click();
 await item.click();
}

test('saved timing results identify their model, time and build independently of next test options',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('babelshelf.device-test.report.v1',JSON.stringify({schema:1,createdAt:'2026-10-20T01:02:03.000Z',appBuild:'previous-build',checks:[],modelGeneration:{status:'pass',testMode:'performance',model:'4B',modelRevision:'model-revision',runtimeRevision:'runtime-revision',outputTokens:128,tokensPerSecond:7.42}})));
 await page.goto('/');await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('menuitem',{name:'Settings'}).click();await openSettingsItem(page,'Developer');
 await expect(page.getByText('Last test · Performance',{exact:true})).toBeVisible();
 await expect(page.locator('time[datetime="2026-10-20T01:02:03.000Z"]')).toBeVisible();
 await expect(page.getByText('4B · Passed',{exact:true})).toBeVisible();
 await expect(page.getByText('previous-build',{exact:true})).toBeVisible();
 await page.locator('.device-test-steps > summary').filter({hasText:'Test options'}).click();
 await page.getByRole('button',{name:'Quick',exact:true}).click();
 await expect(page.getByText('Last test · Performance',{exact:true})).toBeVisible();
 await expect(page.getByText('7.42 tokens/s',{exact:true})).toBeVisible();
 await expect(page.getByText('previous-build',{exact:true})).toBeVisible();
});

test('Settings keeps common choices visible and groups advanced actions under More',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings'}).click();
 await expect(page.getByRole('heading',{name:'Settings',exact:true})).toBeVisible();
 for(const name of ['Models','Files & media','Appearance','Connection','Local files']){
  await expect(page.getByRole('button',{name,exact:true})).toBeVisible();
 }
 const more=page.locator('.settings-more');
 await expect(more.locator('summary')).toHaveText('More');
 await expect(more).not.toHaveAttribute('open','');
 await expect(page.getByRole('button',{name:'Developer',exact:true})).toHaveCount(0);
 await more.locator('summary').click();
 for(const name of ['Assistant','Tools','Developer','Tool files','Restore defaults']){
  await expect(page.getByRole('button',{name,exact:true})).toBeVisible();
 }
});


test('iOS Home Screen standalone signal is retained even when display-mode is unavailable',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(navigator,'standalone',{configurable:true,value:true}));
 await page.goto('/');
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings'}).click();
 await openSettingsItem(page,'Developer');
 await expect(page.getByRole('heading',{name:'Developer',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Run tests'}).click();
 const details=page.locator('.device-test-report');
 await expect(details).toBeVisible({timeout:30_000});
 await details.locator('summary').click();
 expect(JSON.parse((await page.locator('.diagnostic-report').textContent())??'{}').standalone).toBe(true);
});

test('Settings device test creates a local report that can be copied for handoff',async({page,browserName})=>{
 if(browserName==='chromium')await page.context().grantPermissions(['clipboard-read','clipboard-write']);
 await page.addInitScript(()=>{
  Object.defineProperty(window,'__capturedDeviceHandoff',{value:null,writable:true,configurable:true});
  const clipboard=navigator.clipboard;
  if(!clipboard||typeof clipboard.writeText!=='function')return;
  const write=clipboard.writeText.bind(clipboard);
  try{Object.defineProperty(clipboard,'writeText',{configurable:true,value:async(text:string)=>{(window as any).__capturedDeviceHandoff=text;return write(text);}});}catch{}
 });
 await page.goto('/');
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings'}).click();
 await openSettingsItem(page,'Developer');
 await expect(page.getByRole('heading',{name:'Device test'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Run tests',exact:true})).toHaveCount(1);
 await expect(page.getByRole('button',{name:'Test selected model'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Start restart test'})).toHaveCount(0);

 await page.getByRole('button',{name:'Run tests'}).click();
 const report=page.locator('.device-test-report');
 await expect(report).toBeVisible({timeout:30000});
 const text=await page.locator('.diagnostic-report').textContent();
 const parsed=JSON.parse(text??'{}');
 expect(parsed.schema).toBe(1);
 expect(parsed.checks.length).toBeGreaterThan(0);
 expect(parsed.checks.find((check:{id:string})=>check.id==='wasm-threads')).toMatchObject({status:expect.stringMatching(/pass|warning/)});
 expect(parsed.scope.join(' ')).toContain('does not prove a selected engine used a worker pool');
 expect(parsed.checks.find((check:{id:string})=>check.id==='memory-store-smoke')).toMatchObject({status:'pass'});
 expect(parsed.checks.find((check:{id:string})=>check.id==='home-screen-launch')).toMatchObject({status:'warning'});
 expect(parsed.checks.find((check:{id:string})=>check.id==='opfs-roundtrip')).toMatchObject({status:expect.stringMatching(/pass|not-run/)});
 expect(parsed).not.toHaveProperty('prompt');
 expect(parsed).not.toHaveProperty('notes');
 expect(parsed).not.toHaveProperty('modelOutput');
 const copy=page.getByRole('button',{name:'Copy report for Codex'});
 await expect(copy).toBeVisible();
 await copy.click();
 const handoffField=page.locator('.diagnostic-handoff');
 const handoff=await handoffField.count()?await handoffField.inputValue():await page.evaluate(()=>((window as any).__capturedDeviceHandoff??''));
 expect(handoff).toContain('BabelShelf device test');
 expect(handoff).toContain('implement any code fix that can be made from the report');
 expect(handoff).toContain('complete PC preflight, then request one targeted rerun');
 expect(handoff).toContain('checks');
 expect(handoff).not.toContain('Write…');
});

test('chat shows a clear higher connection state and shares the selected mode with Settings',async({page})=>{
 await page.goto('/');
 const offline=page.getByRole('button',{name:'Offline · Tap to switch Online'});
 await expect(offline).toBeVisible();
 await expect(offline).toContainText('Offline');
 await expect(offline).toHaveAttribute('aria-pressed','false');
 const appTop=await page.locator('.mobile-app-viewport').evaluate(element=>element.getBoundingClientRect().top);
 expect(((await offline.boundingBox())?.y??1000)-appTop).toBeLessThan(65);
 await offline.click();
 const online=page.getByRole('button',{name:'Online · Tap to switch Offline'});
 await expect(online).toHaveAttribute('aria-pressed','true');
 await expect(online).toBeEnabled();
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings'}).click();
 await page.getByRole('button',{name:'Connection',exact:true}).click();
 const connectionMode=page.getByRole('group',{name:'App connection mode'});
 await expect(connectionMode.getByRole('button',{name:'Online'})).toHaveAttribute('aria-pressed','true');
});

test('chat connection mode survives a full page reload',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Offline · Tap to switch Online'}).click();
 await expect(page.getByRole('button',{name:'Online · Tap to switch Offline'})).toHaveAttribute('aria-pressed','true');
 await page.reload();
 await expect(page.getByRole('button',{name:'Online · Tap to switch Offline'})).toHaveAttribute('aria-pressed','true');
});

test('chat exposes an explicit app refresh beside the online/offline control',async({page})=>{
 await page.goto('/');
 const refresh=page.getByRole('button',{name:'Update app'});
 await expect(refresh).toBeVisible();
 await expect(refresh).toBeDisabled();
 await expect(refresh).toContainText('Update');
 const appTop=await page.locator('.mobile-app-viewport').evaluate(element=>element.getBoundingClientRect().top);
 expect(((await refresh.boundingBox())?.y??1000)-appTop).toBeLessThan(65);
 await page.getByRole('button',{name:'Offline · Tap to switch Online'}).click();
 await expect(refresh).toBeEnabled();
 await expect(refresh).toHaveAttribute('title','Check for and apply app updates');
 const message=page.getByRole('textbox',{name:'Message'});
 await message.fill('Keep this unsent note');
 await expect(refresh).toBeDisabled();
 await message.fill('');
 await expect(refresh).toBeEnabled();
});

test('app refresh is available online and blocked while a draft could be lost',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings'}).click();
 await page.getByRole('button',{name:'Connection',exact:true}).click();
 const refresh=page.getByRole('button',{name:'Refresh app and check for updates'});
 await expect(refresh).toBeDisabled();
 await page.getByRole('group',{name:'App connection mode'}).getByRole('button',{name:'Online'}).click();
 await expect(refresh).toBeEnabled();
 await page.goto('/');
 await page.getByRole('textbox',{name:'Message'}).fill('Keep this unsent note');
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings'}).click();
 await page.getByRole('button',{name:'Connection',exact:true}).click();
 await expect(refresh).toBeDisabled();
 await expect(page.getByRole('status').filter({hasText:'Finish current work before refreshing'})).toBeVisible();
});

test('one iOS offline handoff stores a local continuation marker and asks for one run',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(navigator,'standalone',{configurable:true,value:true}));
 await page.goto('/');
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings'}).click();
 await openSettingsItem(page,'Developer');
 await page.getByRole('button',{name:'Run tests'}).click();
 await expect(page.getByText('Checks saved · model test after restart',{exact:true})).toBeVisible({timeout:30_000});
 const marker=await page.evaluate(()=>localStorage.getItem('babelshelf.device-test.offline-restart.v1'));
 const parsedMarker=JSON.parse(marker??'null');expect(parsedMarker).toMatchObject({schema:1,baseline:{checks:expect.any(Array)}});expect(parsedMarker.baseline.checks.length).toBeGreaterThan(0);
 expect(parsedMarker.modelTestRequested).toBe(true);
 await expect(page.getByText('Turn on Airplane Mode.',{exact:true})).toBeVisible();
});

test('a saved return check resumes after reload and leaves a copyable handoff',async({page,browserName})=>{
 await page.addInitScript(()=>Object.defineProperty(navigator,'standalone',{configurable:true,value:true}));
 await page.addInitScript(()=>{
  Object.defineProperty(window,'__capturedDeviceHandoff',{value:null,writable:true,configurable:true});
  const clipboard=navigator.clipboard;
  if(!clipboard||typeof clipboard.writeText!=='function')return;
  const write=clipboard.writeText.bind(clipboard);
  try{Object.defineProperty(clipboard,'writeText',{configurable:true,value:async(text:string)=>{(window as any).__capturedDeviceHandoff=text;return write(text);}});}catch{}
 });
 await page.addInitScript(()=>Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>localStorage.getItem('device-test-offline')!=='true'}));
 await page.goto('/');
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings'}).click();
 await openSettingsItem(page,'Developer');
 await page.getByRole('button',{name:'Run tests'}).click();
 await expect(page.getByText('Checks saved · model test after restart',{exact:true})).toBeVisible({timeout:30_000});
 const baseline=await page.evaluate(()=>JSON.parse(localStorage.getItem('babelshelf.device-test.report.v1')??'{}'));
 await page.evaluate(()=>localStorage.setItem('device-test-offline','true'));
 await page.reload();

 await expect(page.getByRole('heading',{name:'Device test'})).toBeVisible({timeout:30000});
 await expect.poll(()=>page.evaluate(()=>localStorage.getItem('babelshelf.device-test.offline-restart.v1')),{timeout:30_000}).toBeNull();
 await expect(page.getByRole('button',{name:'Copy report for Codex'})).toBeVisible({timeout:30000});
 const report=JSON.parse((await page.locator('.diagnostic-report').textContent())??'{}');
 expect(report.offlineRestart).toMatchObject({previousBuild:baseline.appBuild,returnObserved:true});
 expect(report.modelGeneration).toMatchObject({status:'not-run',failureType:'model-files-not-ready'});
 expect(report.checks.some((check:{id:string})=>check.id==='offline-cold-reopen')).toBe(true);
 expect(await page.evaluate(()=>localStorage.getItem('babelshelf.device-test.offline-restart.v1'))).toBeNull();
 if(browserName==='chromium')await page.context().grantPermissions(['clipboard-read','clipboard-write']);
 await page.getByRole('button',{name:'Copy report for Codex'}).click();
 const status=page.getByRole('status').filter({hasText:/Codex handoff copied|Handoff selected · Copy/});
 await expect(status).toBeVisible();
 const handoffField=page.locator('.diagnostic-handoff');
 const handoff=await handoffField.count()?await handoffField.inputValue():await page.evaluate(()=>((window as any).__capturedDeviceHandoff??''));
 expect(handoff).toContain('offline-cold-reopen');
 expect(handoff).toContain('Do not infer that Airplane Mode or force-close occurred');
});

test('an interrupted one-run return is reported once without automatically repeating probes or model execution',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(navigator,'standalone',{configurable:true,value:true}));
 await page.goto('/');
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings'}).click();
 await openSettingsItem(page,'Developer');
 await page.getByRole('button',{name:'Run tests'}).click();
 await expect(page.getByText('Checks saved · model test after restart',{exact:true})).toBeVisible({timeout:30_000});
 const before=JSON.parse((await page.locator('.diagnostic-report').textContent())??'{}');
 await page.evaluate(()=>{
  const key='babelshelf.device-test.offline-restart.v1',marker=JSON.parse(localStorage.getItem(key)??'null');
  localStorage.setItem(key,JSON.stringify({...marker,returnAttempted:true,modelTestRequested:true,modelTestModel:'text-local'}));
 });
 await page.reload();
 await expect(page.getByRole('heading',{name:'Device test'})).toBeVisible({timeout:30_000});
 const interrupted=JSON.parse((await page.locator('.diagnostic-report').textContent())??'{}');
 expect(interrupted.createdAt).not.toBe(before.createdAt);
 expect(interrupted.checks.find((check:{id:string})=>check.id==='offline-cold-reopen')).toMatchObject({status:'warning',detail:expect.stringMatching(/interrupted/i)});
 expect(interrupted.modelGeneration).toMatchObject({status:'interrupted',model:'text-local',failureType:'return-attempt-interrupted'});
 expect(await page.evaluate(()=>localStorage.getItem('babelshelf.device-test.offline-restart.v1'))).toBeNull();
 const interruptedText=await page.evaluate(()=>localStorage.getItem('babelshelf.device-test.report.v1'));
 await page.reload();
 // Storage hydration, rather than dev-server network idleness, is the app's
 // prerequisite for consuming the one-run marker.
 await expect(page.getByRole('textbox',{name:'Message'})).toBeEnabled();
 await page.waitForTimeout(500);
 expect(await page.evaluate(()=>localStorage.getItem('babelshelf.device-test.report.v1'))).toBe(interruptedText,'a cleared one-run marker cannot trigger another automatic test');
 expect(await page.evaluate(()=>localStorage.getItem('babelshelf.device-test.offline-restart.v1'))).toBeNull();
});

test('one Run binds the selected model before the installed-app restart without another checkbox',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(navigator,'standalone',{configurable:true,value:true}));
 await page.goto('/');await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('menuitem',{name:'Settings'}).click();await openSettingsItem(page,'Developer');
 await expect(page.getByRole('checkbox',{name:'Test model after restart'})).toHaveCount(0);
 await page.getByRole('button',{name:'Run tests'}).click();await expect(page.getByText('Checks saved · model test after restart',{exact:true})).toBeVisible({timeout:30_000});
 const marker=JSON.parse((await page.evaluate(()=>localStorage.getItem('babelshelf.device-test.offline-restart.v1')))??'null');
 expect(marker.modelTestRequested).toBe(true);expect(marker.modelTestModel).toBeTruthy();
 await page.getByRole('button',{name:'Cancel test',exact:true}).click();expect(await page.evaluate(()=>localStorage.getItem('babelshelf.device-test.offline-restart.v1'))).toBeNull();
});

test('Connection settings label navigator.onLine as a browser signal, not verified reachability',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings'}).click();
 await page.getByRole('button',{name:'Connection',exact:true}).click();
 await expect(page.getByText('Browser network signal')).toBeVisible();
 await expect(page.getByRole('status').filter({hasText:/Online signal|Offline signal/})).toBeVisible();
 await expect(page.getByText('Available',{exact:true})).toHaveCount(0);
});

test('diagnostic log review opens an editable chat draft without sending it',async({page})=>{
 await page.goto('/');
 await page.evaluate(()=>localStorage.setItem('babelshelf.diagnostic-logs.v1',JSON.stringify([{schema:1,id:'review-me',at:new Date().toISOString(),tool:'dialogue.plan',status:'failed',code:'planner_protocol',message:'The planner response did not match the required action format.'}])));
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings'}).click();
 await openSettingsItem(page,'Developer');
 await expect(page.getByRole('button',{name:'Run tests',exact:true})).toBeVisible();
 await expect(page.locator('section[aria-label="Diagnostic logging"]')).toHaveCount(1);
 await expect(page.locator('button').filter({hasText:'Ask model'})).toHaveCount(0);
 await expect(page.locator('section[aria-label="Diagnostic entries"]:visible')).toContainText('The planner response did not match the required action format.');
 await page.getByRole('button',{name:'Review with model'}).click();
 const composer=page.getByRole('textbox',{name:'Message'});
 await expect(composer).toHaveValue(/Diagnose these local operation failures/);
 await expect(composer).toHaveValue(/planner_protocol/);
});

test('installed Performance uses one Run without requiring a restart or model download',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(navigator,'standalone',{configurable:true,value:true}));await page.goto('/');await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('menuitem',{name:'Settings'}).click();await openSettingsItem(page,'Developer');
 await page.getByText('Test options · Quick',{exact:true}).click();await page.getByRole('button',{name:'Performance',exact:true}).click();await expect(page.getByRole('button',{name:'Run tests',exact:true})).toHaveCount(1);await page.getByRole('button',{name:'Run tests',exact:true}).click();await expect(page.getByRole('button',{name:'Copy report for Codex'})).toBeEnabled();
 await expect(page.getByRole('heading',{name:'Restart needed',exact:true})).toHaveCount(0);await expect(page.getByText('Runs here · No restart · Up to 128 tokens · More battery',{exact:true})).toBeVisible();const marker=await page.evaluate(()=>localStorage.getItem('babelshelf.device-test.offline-restart.v1'));expect(marker).toBeNull();const report=JSON.parse((await page.locator('.diagnostic-report').textContent())??'{}');expect(report.modelGeneration).toMatchObject({testMode:'performance',status:'not-run',failureType:'model-files-not-ready'});await expect(page.getByText('Load',{exact:true})).toHaveCount(0);expect(report.manualSteps.join(' ')).not.toMatch(/Airplane|Home Screen/);await page.reload();await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('menuitem',{name:'Settings'}).click();await openSettingsItem(page,'Developer');await expect(page.getByText('Last test · Performance',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Copy report for Codex'})).toBeEnabled();const retained=JSON.parse((await page.locator('.diagnostic-report').textContent())??'{}');expect(retained.createdAt).toBe(report.createdAt);
});

test('a legacy Performance restart marker still completes once after an update',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(navigator,'standalone',{configurable:true,value:true}));await page.goto('/');await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('menuitem',{name:'Settings'}).click();await openSettingsItem(page,'Developer');await page.getByRole('button',{name:'Run tests',exact:true}).click();await expect(page.getByText('Checks saved · model test after restart',{exact:true})).toBeVisible();
 await page.evaluate(()=>{const key='babelshelf.device-test.offline-restart.v1',marker=JSON.parse(localStorage.getItem(key)!);marker.modelTestMode='performance';localStorage.setItem(key,JSON.stringify(marker));});await page.reload();await expect(page.getByRole('button',{name:'Copy report for Codex'})).toBeVisible();await expect(page.getByText('Test options · Performance',{exact:true})).toBeVisible();await expect.poll(()=>page.evaluate(()=>localStorage.getItem('babelshelf.device-test.offline-restart.v1'))).toBeNull();
});

test('a new run cannot copy the previous result as if it were the current test',async({page})=>{
 await page.addInitScript(()=>{localStorage.setItem('babelshelf.device-test.report.v1',JSON.stringify({schema:1,createdAt:new Date().toISOString(),checks:[],modelGeneration:{status:'pass',model:'old',modelRevision:'old-rev',runtimeRevision:'old-runtime'}}));Object.defineProperty(navigator,'gpu',{configurable:true,value:{requestAdapter:()=>new Promise(resolve=>{(window as any).__releaseGpuProbe=()=>resolve(null);})}});});
 await page.goto('/');await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('menuitem',{name:'Settings'}).click();await openSettingsItem(page,'Developer');await page.getByRole('button',{name:'Run tests'}).click();await expect(page.getByRole('button',{name:'Copy report for Codex'})).toBeDisabled();await expect(page.getByText('Previous report',{exact:true})).toBeVisible();await page.waitForFunction(()=>typeof (window as any).__releaseGpuProbe==='function');await page.evaluate(()=>(window as any).__releaseGpuProbe());await expect(page.getByRole('button',{name:'Copy report for Codex'})).toBeEnabled();
});
