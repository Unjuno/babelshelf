import {expect,test,type Page} from '@playwright/test';

for(const action of ['type','offline'] as const)test(`working during app update: ${action} prevents reload`,async({page})=>{
 await page.addInitScript(()=>{
  const registration={active:{state:'activated'},installing:null,waiting:null,addEventListener(){},removeEventListener(){},
   update:()=>new Promise(resolve=>{(window as any).__releaseUpdate=()=>resolve(registration);})};
  Object.defineProperty(navigator.serviceWorker,'getRegistration',{configurable:true,value:async()=>registration});
 });
 await openApp(page);
 await page.getByRole('button',{name:'Offline · Tap to switch Online'}).click();
 await page.getByRole('button',{name:'Update app'}).click();
 await page.waitForFunction(()=>typeof (window as any).__releaseUpdate==='function');
 await expect(page.getByRole('button',{name:'Update app'})).toHaveText('Updating…');
 await expect(page.getByRole('button',{name:'Update app'})).toHaveAttribute('aria-busy','true');
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
 const update=page.getByRole('button',{name:'Update app'});
 await expect(update).toHaveText('Update');
 if(action==='type')await expect(update).toHaveAttribute('data-blocked','true');
 else await expect(update).toBeDisabled();
});

async function openSettingsItem(page:Page,name:string){
 const item=page.getByRole('button',{name,exact:true});
 if(!(await item.isVisible()))await page.locator('.settings-more > summary').click();
 await item.click();
}

async function openApp(page:Page){
 await page.goto('/',{waitUntil:'domcontentloaded'});
 await expect(page.getByRole('textbox',{name:'Message'})).toBeEnabled({timeout:30_000});
}

test('saved timing results identify their model, time and build independently of next test options',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('babelshelf.device-test.report.v1',JSON.stringify({schema:1,createdAt:'2026-10-20T01:02:03.000Z',appBuild:'previous-build',checks:[],modelGeneration:{status:'pass',testMode:'performance',model:'4B',modelRevision:'model-revision',runtimeRevision:'runtime-revision',outputTokens:128,tokensPerSecond:7.42}})));
 await openApp(page);await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('menuitem',{name:'Settings'}).click();await openSettingsItem(page,'Developer');
 await expect(page.getByText('Last test · Performance',{exact:true})).toBeVisible();
 await expect(page.locator('time[datetime="2026-10-20T01:02:03.000Z"]')).toBeVisible();
 await expect(page.getByText('4B · Sample complete',{exact:true})).toBeVisible();
 await expect(page.getByText('previous-build',{exact:true})).toBeVisible();
 await expect(page.getByRole('status').filter({hasText:'This report is from a different app build. Run the check again to verify the current build.'})).toBeVisible();
 await page.locator('.device-test-steps > summary').filter({hasText:'Test options'}).click();
 await page.getByRole('button',{name:'Quick',exact:true}).click();
 await expect(page.getByText('Last test · Performance',{exact:true})).toBeVisible();
 await expect(page.getByText('7.42 tokens/s',{exact:true})).toBeVisible();
 await expect(page.getByText('previous-build',{exact:true})).toBeVisible();
});

test('browser starts with a report-only App & storage check; every test type has a visible overview',async({page})=>{
 await openApp(page);await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('menuitem',{name:'Settings'}).click();await openSettingsItem(page,'Developer');
 await expect(page.getByRole('region',{name:'App & storage overview'})).toContainText('No model load or download');
 await expect(page.getByRole('button',{name:'Run app checks',exact:true})).toBeVisible();
 await page.getByText('Test options · App & storage',{exact:true}).click();
 for(const mode of ['App & storage','Offline readiness','Storage health','Runtime support','Model readiness','Quick','Performance','Full cycle'])await expect(page.getByRole('button',{name:mode,exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Quick',exact:true}).click();await expect(page.getByRole('region',{name:'Quick overview'})).toContainText('loads the prepared model into memory first');await expect(page.getByRole('region',{name:'Quick overview'})).toContainText('No download');
 await page.getByRole('button',{name:'Performance',exact:true}).click();await expect(page.getByRole('region',{name:'Performance overview'})).toContainText('may still load into memory first');
 await page.getByRole('button',{name:'Model readiness',exact:true}).click();await expect(page.getByRole('region',{name:'Model readiness overview'})).toContainText('No model load, generation, or download');
 await page.getByRole('button',{name:'Check model readiness',exact:true}).click();await expect(page.getByRole('region',{name:'Last test overview · Model readiness'})).toBeVisible();
 let readinessReport=JSON.parse((await page.locator('.diagnostic-report').textContent())??'{}');expect(readinessReport.deviceTestMode).toBe('model-readiness');expect(readinessReport.modelGeneration).toBeUndefined();
 const summaries=page.getByRole('region',{name:'Check results · 13 areas'});await expect(summaries).toBeVisible();for(const area of ['Secure context','Service worker','Installed launch','Build identity','Offline cache','Browser storage','Memory workflow','Model coordination','WASM runtime','GPU capability','Model files','Model reply','Offline restart'])await expect(summaries.getByText(area,{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'App & storage',exact:true}).click();
 const overview=page.getByRole('region',{name:'App & storage overview'});await expect(overview).toContainText('No model load or download');
 await expect(page.getByRole('button',{name:'Run app checks',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Run app checks',exact:true}).click();await expect(page.getByRole('button',{name:'Copy report for Codex'})).toBeEnabled();
 const report=JSON.parse((await page.locator('.diagnostic-report').textContent())??'{}');expect(report.deviceTestMode).toBe('app');expect(report.modelGeneration).toBeUndefined();
 await expect(page.getByRole('region',{name:'Last test overview · App & storage'})).toContainText('No model load or download');
 await expect(page.getByRole('region',{name:'Check results · 13 areas'})).toBeVisible();
});

test('focused Offline, Storage and Runtime diagnostics each show a result overview',async({page})=>{
 await openApp(page);await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('menuitem',{name:'Settings'}).click();await openSettingsItem(page,'Developer');await page.getByText('Test options · App & storage',{exact:true}).click();
 for(const [label,button,focus] of [['Offline readiness','Check offline readiness','Offline cache'],['Storage health','Check storage','Browser storage'],['Runtime support','Check runtime support','GPU capability']] as const){
  await page.getByRole('button',{name:label,exact:true}).click();await expect(page.getByRole('region',{name:`${label} overview`})).toContainText(focus);
  await page.getByRole('button',{name:button,exact:true}).click();const result=page.getByRole('region',{name:`Last test overview · ${label}`});await expect(result).toContainText('areas');await expect(result).toContainText('ready');
  const report=JSON.parse((await page.locator('.diagnostic-report').textContent())??'{}');expect(report.deviceTestMode).toBe(label==='Offline readiness'?'offline-readiness':label==='Storage health'?'storage-health':'runtime-support');expect(report.modelGeneration).toBeUndefined();
 }
});

test('legacy timing reports use their workload when testMode is absent',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('babelshelf.device-test.report.v1',JSON.stringify({schema:1,createdAt:'2026-10-20T01:02:03.000Z',appBuild:'legacy-build',checks:[],selectedModel:{id:'4B',revision:'m',backend:'webgpu',runtimeRevision:'r',filesPresent:true,loaded:true},modelGeneration:{status:'pass',workload:'prose-128-v1',model:'4B',modelRevision:'m',runtimeRevision:'r',outputTokens:96,tokensPerSecond:6.5}})));
 await openApp(page);await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('menuitem',{name:'Settings'}).click();await openSettingsItem(page,'Developer');
 await expect(page.getByText('Last test · Performance',{exact:true})).toBeVisible();await expect(page.getByText('4B · Sample complete',{exact:true})).toBeVisible();await expect(page.getByText('Overall speed',{exact:true})).toBeVisible();await expect(page.getByText('6.50 tokens/s',{exact:true})).toBeVisible();
});

test('an incomplete timing response is explained in plain language',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('babelshelf.device-test.report.v1',JSON.stringify({schema:1,createdAt:'2026-10-20T01:02:03.000Z',appBuild:'fixture',checks:[],modelGeneration:{status:'fail',testMode:'performance',model:'4B',modelRevision:'m',runtimeRevision:'r',failureStage:'output-validation',failureType:'incomplete-output'}})));
 await openApp(page);await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('menuitem',{name:'Settings'}).click();await openSettingsItem(page,'Developer');
 await expect(page.getByText('4B · Incomplete output',{exact:true})).toBeVisible();
 await expect(page.getByText('Failed · output-validation',{exact:true})).toHaveCount(0);
});

test('runtime setup failure shows an actionable safe classification in the device report',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('babelshelf.device-test.report.v1',JSON.stringify({schema:1,createdAt:'2026-11-04T01:02:03.000Z',appBuild:'fixture',deviceTestMode:'full-cycle',checks:[{id:'selected-model',status:'fail',detail:'local: test failed · runtime-network-error'}],selectedModel:{id:'local',revision:'m',backend:'webgpu',runtimeRevision:'r',contextTokens:8192,filesPresent:false,loaded:false},modelGeneration:{status:'fail',testMode:'full-cycle',model:'local',modelRevision:'m',runtimeRevision:'r',failureStage:'runtime-setup',failureType:'runtime-network-error',runtimePreparationDurationMs:1764321,runtimeBytesRead:73400320,runtimeDownloadedBytes:67108864,assetState:'not-run',expectedModelBytes:1049615680}})));
 await openApp(page);await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('menuitem',{name:'Settings'}).click();await openSettingsItem(page,'Developer');
 await expect(page.getByText('local · Runtime download failed',{exact:true})).toBeVisible();await expect(page.getByText('Runtime check / setup',{exact:true})).toBeVisible();await expect(page.getByText('Runtime bytes read',{exact:true})).toBeVisible();await expect(page.getByText('70.0 MB · includes cache',{exact:true})).toBeVisible();await expect(page.getByText('Runtime downloaded',{exact:true})).toBeVisible();await page.getByText('Report',{exact:true}).click();await expect(page.locator('.diagnostic-report')).toContainText('runtime-network-error');await expect(page.locator('.diagnostic-report')).not.toContainText('private');
});

test('generic runtime failure explains that model preparation and generation did not run',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('babelshelf.device-test.report.v1',JSON.stringify({schema:1,createdAt:'2026-11-03T15:23:49.022Z',appBuild:'fixture',deviceTestMode:'full-cycle',checks:[{id:'selected-model',status:'fail',detail:'lfm3: test failed · Error'}],selectedModel:{id:'lfm3',revision:'m',backend:'webgpu',runtimeRevision:'r',filesPresent:false,loaded:false},modelGeneration:{status:'fail',testMode:'full-cycle',model:'lfm3',modelRevision:'m',runtimeRevision:'r',failureStage:'runtime-setup',failureType:'Error',runtimePreparationDurationMs:1764321,assetState:'not-run',expectedModelBytes:1049615680}})));
 await openApp(page);await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('menuitem',{name:'Settings'}).click();await openSettingsItem(page,'Developer');
 await expect(page.getByText('lfm3 · Runtime setup failed',{exact:true})).toBeVisible();await expect(page.getByText('Runtime setup stopped before model preparation. Model files were not downloaded, and no model load or generation was tested.',{exact:true})).toBeVisible();
});

test('performance distinguishes configured route, quantization, context limit, selected runtime backend, and unreported runtime GPU offload',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('babelshelf.device-test.report.v1',JSON.stringify({schema:1,createdAt:'2026-10-20T01:02:03.000Z',appBuild:'fixture',platform:'iPhone',userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6.1 Mobile/15E148 Safari/604.1',checks:[],hardware:{logicalProcessors:6,memoryGiBEstimate:8},selectedModel:{id:'4B',revision:'m',engine:'wllama-lfm3',backend:'webgpu',runtimeRevision:'r',contextTokens:8192,filesPresent:true,loaded:true},modelGeneration:{status:'pass',testMode:'performance',model:'4B',modelRevision:'m',runtimeRevision:'r',quantization:'Q8_0',outputTokens:128,tokensPerSecond:7.42,loadMetrics:{executionBackend:'cpu-wasm',gpuFallbackReason:'webgpu-no-layers-offloaded'},runtimeMetrics:{runtimePrefillMs:2345,visibleTextTtftMs:840,runtimeDecodeTokensPerSecond:12.34}}})));
 await openApp(page);await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('menuitem',{name:'Settings'}).click();await openSettingsItem(page,'Developer');
 const fallback=page.locator('section[aria-label="Device test"] .capability-row:visible').filter({hasText:'GPU fallback'});
 await expect(fallback).toBeVisible();await expect(fallback).toContainText('GPU ran no model layers · CPU/WASM used');
 await expect(page.getByText('Model load',{exact:true})).toBeVisible();await expect(page.getByText('Runtime · first text',{exact:true})).toBeVisible();await expect(page.getByText('Overall speed',{exact:true})).toBeVisible();await expect(page.getByText('7.42 tokens/s',{exact:true})).toBeVisible();await expect(page.getByText('Test environment',{exact:true})).toBeVisible();await expect(page.getByText('iPhone · Safari 26.6.1',{exact:true})).toBeVisible();await expect(page.getByText('Run on',{exact:true})).toBeVisible();await expect(page.getByText('CPU · WASM',{exact:true})).toBeVisible();await page.getByText('Technical details',{exact:true}).click();await expect(page.getByText('Quantization',{exact:true})).toBeVisible();await expect(page.getByText('Q8_0',{exact:true})).toBeVisible();await expect(page.getByText('Context limit · configured',{exact:true})).toBeVisible();await expect(page.getByText('8,192 tokens',{exact:true})).toBeVisible();await expect(page.getByText('Backend route · configured',{exact:true})).toBeVisible();await expect(page.getByText('WebGPU',{exact:true})).toBeVisible();await expect(page.getByText('Logical processors · browser',{exact:true})).toBeVisible();await expect(page.getByText('6',{exact:true})).toBeVisible();await expect(page.getByText('Memory estimate · browser',{exact:true})).toBeVisible();await expect(page.getByText('8 GiB',{exact:true})).toBeVisible();await expect(page.getByText('Prompt processing · runtime',{exact:true})).toBeVisible();await expect(page.getByText('2.35 s',{exact:true})).toBeVisible();await expect(page.getByText('Decode speed',{exact:true})).toBeVisible();await expect(page.getByText('12.34 tokens/s',{exact:true})).toBeVisible();
});

test('performance displays runtime mode and GPU layer counts in the result summary',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('babelshelf.device-test.report.v1',JSON.stringify({schema:1,createdAt:'2026-10-20T01:02:03.000Z',appBuild:'fixture',checks:[],selectedModel:{id:'4B',revision:'m',engine:'wllama-lfm3',backend:'webgpu',runtimeRevision:'r',filesPresent:true,loaded:true},modelGeneration:{status:'pass',testMode:'performance',model:'4B',modelRevision:'m',runtimeRevision:'r',outputTokens:128,tokensPerSecond:7.42,loadMetrics:{executionBackend:'webgpu',runtimeVariant:'compatibility'},runtimeMetrics:{runtimeDecodeTokensPerSecond:12.34,runtimeObservedGpuLayers:24,runtimeObservedGpuTotalLayers:28}}})));
 await openApp(page);await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('menuitem',{name:'Settings'}).click();await openSettingsItem(page,'Developer');await expect(page.getByText('Run on',{exact:true})).toBeVisible();await expect(page.getByText('WebGPU · 24/28 GPU layers',{exact:true})).toBeVisible();await expect(page.getByText('WASM mode',{exact:true})).toBeVisible();await expect(page.getByText('Compatibility',{exact:true})).toBeVisible();await page.getByText('Technical details',{exact:true}).click();await expect(page.getByText('Backend route · configured',{exact:true})).toBeVisible();await expect(page.getByText('WebGPU',{exact:true})).toBeVisible();
});

test('full-cycle results and timings remain visible and copy into the Codex handoff',async({page})=>{
 await page.addInitScript(()=>{
  localStorage.setItem('babelshelf.device-test.report.v1',JSON.stringify({schema:1,createdAt:'2026-10-20T01:02:03.000Z',appBuild:'fixture',checks:[],selectedModel:{id:'4B',revision:'m',engine:'wllama-lfm3',backend:'webgpu',runtimeRevision:'r',filesPresent:true,loaded:true},modelGeneration:{status:'pass',testMode:'full-cycle',model:'4B',modelRevision:'m',runtimeRevision:'r',assetState:'prepared',expectedModelBytes:1800000000,downloadedBytes:1800000000,preparationDurationMs:42000,modelStartToFirstTextMs:12000,warmDurationMs:5500,warmOutputTokens:64,warmTokensPerSecond:11.64,loadState:'already-loaded',runtimeMetrics:{visibleTextTtftMs:840}}}));
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{(window as any).__capturedDeviceHandoff=text;}}});
 });
 await openApp(page);await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('menuitem',{name:'Settings'}).click();await openSettingsItem(page,'Developer');
 await expect(page.getByText('Run → first text',{exact:true})).toBeVisible();await expect(page.getByText('12.0 s',{exact:true})).toBeVisible();await expect(page.getByText('Runtime · first text',{exact:true})).toBeVisible();await expect(page.getByText('0.84 s',{exact:true})).toBeVisible();
 await expect(page.getByText('Assets',{exact:true})).toBeVisible();await expect(page.getByText('Prepared during test',{exact:true})).toBeVisible();await expect(page.getByText('Warm speed',{exact:true})).toBeVisible();await expect(page.getByText('11.64 tokens/s',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Copy report for Codex'}).click();
 const handoff=await page.evaluate(()=>(window as any).__capturedDeviceHandoff as string);expect(handoff).toContain('"modelStartToFirstTextMs": 12000');expect(handoff).toContain('"warmTokensPerSecond": 11.64');expect(handoff).toContain('"assetState": "prepared"');
});

test('performance does not label an unconfirmed WebGPU route as executed',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('babelshelf.device-test.report.v1',JSON.stringify({schema:1,createdAt:'2026-10-20T01:02:03.000Z',appBuild:'fixture',checks:[],selectedModel:{id:'4B',revision:'m',engine:'wllama-lfm3',backend:'webgpu',runtimeRevision:'r',contextTokens:8192,filesPresent:true,loaded:true},modelGeneration:{status:'pass',testMode:'performance',model:'4B',modelRevision:'m',runtimeRevision:'r',outputTokens:128,tokensPerSecond:7.42,runtimeMetrics:{runtimeObservedGpuLayers:0,runtimeObservedGpuTotalLayers:25}}})));
 await openApp(page);await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('menuitem',{name:'Settings'}).click();await openSettingsItem(page,'Developer');
 await expect(page.getByText('Run on',{exact:true})).toBeVisible();await expect(page.getByText('GPU not confirmed',{exact:true})).toBeVisible();await page.getByText('Technical details',{exact:true}).click();await expect(page.getByText('Backend route · configured',{exact:true})).toBeVisible();await expect(page.getByText('WebGPU',{exact:true})).toBeVisible();await expect(page.getByText('CPU · WASM',{exact:true})).toHaveCount(0);
});

test('performance shows requested and runtime-reported thread counts separately',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('babelshelf.device-test.report.v1',JSON.stringify({schema:1,createdAt:'2026-10-20T01:02:03.000Z',appBuild:'fixture',checks:[],selectedModel:{id:'lfm3',revision:'m',engine:'wllama-lfm3',backend:'webgpu',runtimeRevision:'r',filesPresent:true,loaded:true},modelGeneration:{status:'pass',testMode:'performance',model:'lfm3',modelRevision:'m',runtimeRevision:'r',outputTokens:128,tokensPerSecond:7.42,loadMetrics:{executionBackend:'webgpu'},runtimeMetrics:{requestedThreads:4,runtimeThreads:3}}})));
 await openApp(page);await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('menuitem',{name:'Settings'}).click();await openSettingsItem(page,'Developer');await page.getByText('Technical details',{exact:true}).click();await expect(page.getByText('Threads · runtime',{exact:true})).toBeVisible();await expect(page.getByText('4 requested · 3 reported',{exact:true})).toBeVisible();
});

test('performance shows a bounded browser GPU hint without calling it the inference adapter',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('babelshelf.device-test.report.v1',JSON.stringify({schema:1,createdAt:'2026-10-20T01:02:03.000Z',appBuild:'fixture',checks:[],webgpu:{available:true,fallbackAdapter:false,vendor:'intel',architecture:'gen-12lp',features:[],limits:{},device:'PRIVATE_DEVICE'},selectedModel:{id:'lfm3',revision:'m',engine:'wllama-lfm3',backend:'webgpu',runtimeRevision:'r',filesPresent:true,loaded:true},modelGeneration:{status:'pass',testMode:'performance',model:'lfm3',modelRevision:'m',runtimeRevision:'r',outputTokens:128,tokensPerSecond:7.42,loadMetrics:{executionBackend:'webgpu'},runtimeMetrics:{runtimeDecodeTokensPerSecond:12.34,runtimeObservedGpuLayers:24,runtimeObservedGpuTotalLayers:24}}})));
 await openApp(page);await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('menuitem',{name:'Settings'}).click();await openSettingsItem(page,'Developer');await page.getByText('Technical details',{exact:true}).click();
 const hint=page.locator('section[aria-label="Device test"] .capability-row:visible').filter({hasText:'GPU hint · browser'});await expect(hint).toContainText('intel · gen-12lp');await expect(hint).not.toContainText('PRIVATE_DEVICE');await expect(page.getByText('WebGPU · 24/24 GPU layers',{exact:true})).toBeVisible();
});

test('Settings keeps common choices visible and groups advanced actions under More',async({page})=>{
 await openApp(page);
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
 await openApp(page);
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
 await openApp(page);
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings'}).click();
 await openSettingsItem(page,'Developer');
 await expect(page.getByRole('heading',{name:'Device test'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Run app checks',exact:true})).toHaveCount(1);
 await expect(page.getByRole('button',{name:'Test selected model'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Start restart test'})).toHaveCount(0);

 await page.getByRole('button',{name:'Run app checks'}).click();
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
 expect(handoff).toContain('complete local preflight first');
 expect(handoff).toContain('checks');
 expect(handoff).not.toContain('Write…');
});

test('chat shows a clear higher connection state and shares the selected mode with Settings',async({page})=>{
 await openApp(page);
 await expect(page.getByRole('textbox',{name:'Message'})).toBeEnabled({timeout:30_000});
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
 await openApp(page);
 await expect(page.getByRole('textbox',{name:'Message'})).toBeEnabled({timeout:30_000});
 await page.getByRole('button',{name:'Offline · Tap to switch Online'}).click();
 await expect(page.getByRole('button',{name:'Online · Tap to switch Offline'})).toHaveAttribute('aria-pressed','true');
 await page.reload();
 await expect(page.getByRole('button',{name:'Online · Tap to switch Offline'})).toHaveAttribute('aria-pressed','true');
});

test('explicit online update retries a missing app registration',async({page})=>{
 await page.addInitScript(()=>{
  const sw=navigator.serviceWorker;let attempts=0;
  Object.defineProperty(sw,'getRegistration',{configurable:true,value:async()=>undefined});
  Object.defineProperty(sw,'register',{configurable:true,value:async()=>{attempts++;(window as any).__registrationAttempts=attempts;if(attempts===1)throw Error('initial failure');const registration=new EventTarget() as ServiceWorkerRegistration;Object.defineProperty(registration,'active',{value:{state:'activated'}});return registration;}});
 });
 await openApp(page);await page.getByRole('button',{name:'Offline · Tap to switch Online'}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).__registrationAttempts)).toBe(1);
 await page.getByRole('button',{name:'Update app'}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).__registrationAttempts)).toBe(2);
 await expect(page.getByRole('status').filter({hasText:'App prepared · update again to reopen'})).toBeVisible();
});

test('chat exposes an explicit app refresh beside the online/offline control',async({page})=>{
 await openApp(page);
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
 await expect(refresh).toBeEnabled();await expect(refresh).toHaveAttribute('title','Finish or save current work before updating');
 await refresh.click();await expect(page.getByRole('status').filter({hasText:'Send or clear the draft before updating'})).toBeVisible();await expect(message).toHaveValue('Keep this unsent note');
 await message.fill('');
 await expect(refresh).toBeEnabled();
});

test('app refresh is available online and blocked while a draft could be lost',async({page})=>{
 await openApp(page);
 await expect(page.getByRole('textbox',{name:'Message'})).toBeEnabled({timeout:30_000});
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings'}).click();
 await page.getByRole('button',{name:'Connection',exact:true}).click();
 const refresh=page.getByRole('button',{name:'Refresh app and check for updates'});
 await expect(refresh).toBeDisabled();
 await page.getByRole('group',{name:'App connection mode'}).getByRole('button',{name:'Online'}).click();
 await expect(refresh).toBeEnabled();
 await openApp(page);
 await page.getByRole('textbox',{name:'Message'}).fill('Keep this unsent note');
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings'}).click();
 await page.getByRole('button',{name:'Connection',exact:true}).click();
 await expect(refresh).toBeDisabled();
 await expect(page.getByRole('status').filter({hasText:'Finish current work before refreshing'})).toBeVisible();
});

test('one iOS offline handoff stores a local continuation marker and asks for one run',async({page})=>{
 await page.addInitScript(()=>{Object.defineProperty(navigator,'platform',{configurable:true,value:'iPhone'});Object.defineProperty(navigator,'userAgent',{configurable:true,value:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'});Object.defineProperty(navigator,'standalone',{configurable:true,value:true});});
 await openApp(page);
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings'}).click();
 await openSettingsItem(page,'Developer');
 await page.getByRole('button',{name:'Run tests'}).click();
 await expect(page.getByText('Checks saved · model test after restart',{exact:true})).toBeVisible({timeout:30_000});
 const marker=await page.evaluate(()=>localStorage.getItem('babelshelf.device-test.offline-restart.v1'));
 const parsedMarker=JSON.parse(marker??'null');expect(parsedMarker).toMatchObject({schema:1,baseline:{checks:expect.any(Array)}});expect(parsedMarker.baseline.checks.length).toBeGreaterThan(0);
 expect(parsedMarker.modelTestRequested).toBe(true);
 await expect(page.locator('.device-offline-test')).toContainText('Airplane Mode');
});

test('Windows installed-app restart guidance does not mention iOS actions',async({page})=>{
 await page.addInitScript(()=>{Object.defineProperty(navigator,'platform',{configurable:true,value:'Win32'});Object.defineProperty(navigator,'userAgent',{configurable:true,value:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/149.0.0.0 Safari/537.36'});Object.defineProperty(navigator,'standalone',{configurable:true,value:true});});
 await openApp(page);await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('menuitem',{name:'Settings'}).click();await openSettingsItem(page,'Developer');await expect(page.getByRole('region',{name:'Quick overview'})).toContainText('Installed-app Quick may include a one-run restart check');
 const guide=page.locator('details.device-test-steps').filter({hasText:'Test guide'});await guide.locator('summary').click();await expect(guide).toContainText('start from the installed app, not a browser tab');
 await page.getByRole('button',{name:'Run tests'}).click();
 await expect(page.getByText('Checks saved · model test after restart',{exact:true})).toBeVisible({timeout:30_000});
 const steps=page.locator('.device-offline-test');await expect(steps).toContainText('Disconnect the device from the network');await expect(steps).not.toContainText(/Airplane Mode|Home Screen/);
 const report=JSON.parse(await page.evaluate(()=>localStorage.getItem('babelshelf.device-test.report.v1')??'{}'));expect(report.manualSteps.join(' ')).toContain('installed app');expect(report.manualSteps.join(' ')).not.toMatch(/Airplane Mode|Home Screen|iPhone/);
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
 await openApp(page);
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
 expect(handoff).toContain('Do not infer that network disconnection or force-close occurred');
});

test('an interrupted one-run return is reported once without automatically repeating probes or model execution',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(navigator,'standalone',{configurable:true,value:true}));
 await openApp(page);
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
 await openApp(page);await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('menuitem',{name:'Settings'}).click();await openSettingsItem(page,'Developer');
 await expect(page.getByRole('checkbox',{name:'Test model after restart'})).toHaveCount(0);
 await page.getByRole('button',{name:'Run tests'}).click();await expect(page.getByText('Checks saved · model test after restart',{exact:true})).toBeVisible({timeout:30_000});
 const marker=JSON.parse((await page.evaluate(()=>localStorage.getItem('babelshelf.device-test.offline-restart.v1')))??'null');
 expect(marker.modelTestRequested).toBe(true);expect(marker.modelTestModel).toBeTruthy();
 await page.getByRole('button',{name:'Cancel test',exact:true}).click();expect(await page.evaluate(()=>localStorage.getItem('babelshelf.device-test.offline-restart.v1'))).toBeNull();
});

test('Connection settings label navigator.onLine as a browser signal, not verified reachability',async({page})=>{
 await openApp(page);
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings'}).click();
 await page.getByRole('button',{name:'Connection',exact:true}).click();
 await expect(page.getByText('Browser network signal')).toBeVisible();
 await expect(page.getByRole('status').filter({hasText:/Online signal|Offline signal/})).toBeVisible();
 await expect(page.getByText('Available',{exact:true})).toHaveCount(0);
});

test('diagnostic log review opens an editable chat draft without sending it',async({page})=>{
 await openApp(page);
 await page.evaluate(()=>localStorage.setItem('babelshelf.diagnostic-logs.v1',JSON.stringify([{schema:1,id:'review-me',at:new Date().toISOString(),tool:'dialogue.plan',status:'failed',code:'planner_protocol',message:'The planner response did not match the required action format.'}])));
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings'}).click();
 await openSettingsItem(page,'Developer');
 await expect(page.getByRole('button',{name:'Run app checks',exact:true})).toBeVisible();
 await expect(page.locator('section[aria-label="Diagnostic logging"]')).toHaveCount(1);
 await expect(page.locator('button').filter({hasText:'Ask model'})).toHaveCount(0);
 await expect(page.locator('section[aria-label="Diagnostic entries"]:visible')).toContainText('The planner response did not match the required action format.');
 await page.getByRole('button',{name:'Review with model'}).click();
 const composer=page.getByRole('textbox',{name:'Message'});
 await expect(composer).toHaveValue(/Diagnose these local operation failures/);
 await expect(composer).toHaveValue(/planner_protocol/);
});

test('installed Performance uses one Run without requiring a restart or model download',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(navigator,'standalone',{configurable:true,value:true}));await openApp(page);await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('menuitem',{name:'Settings'}).click();await openSettingsItem(page,'Developer');
 await page.getByText('Test options · Quick',{exact:true}).click();await page.getByRole('button',{name:'Performance',exact:true}).click();await expect(page.getByRole('button',{name:'Run speed sample',exact:true})).toHaveCount(1);await page.getByRole('button',{name:'Run speed sample',exact:true}).click();await expect(page.getByRole('button',{name:'Copy report for Codex'})).toBeEnabled();
 await expect(page.getByRole('heading',{name:'Restart needed',exact:true})).toHaveCount(0);await expect(page.getByRole('region',{name:'Performance overview'})).toContainText('selected model must already be prepared');await expect(page.getByRole('region',{name:'Performance overview'})).toContainText('No download');const marker=await page.evaluate(()=>localStorage.getItem('babelshelf.device-test.offline-restart.v1'));expect(marker).toBeNull();const report=JSON.parse((await page.locator('.diagnostic-report').textContent())??'{}');expect(report.modelGeneration).toMatchObject({testMode:'performance',status:'not-run',failureType:'model-files-not-ready'});await expect(page.getByText('Load',{exact:true})).toHaveCount(0);expect(report.manualSteps.join(' ')).not.toMatch(/Airplane|Home Screen/);await page.reload();await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('menuitem',{name:'Settings'}).click();await openSettingsItem(page,'Developer');await expect(page.getByText('Last test · Performance',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Copy report for Codex'})).toBeEnabled();const retained=JSON.parse((await page.locator('.diagnostic-report').textContent())??'{}');expect(retained.createdAt).toBe(report.createdAt);
});

test('Full cycle explains runtime-first preparation and download requirements before running',async({page})=>{
 await openApp(page);await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('menuitem',{name:'Settings'}).click();await openSettingsItem(page,'Developer');await page.getByText('Test options · App & storage',{exact:true}).click();await page.getByRole('button',{name:'Full cycle',exact:true}).click();
 const overview=page.getByRole('region',{name:'Full cycle overview'});await expect(overview).toContainText('Prepare the separate runtime first');await expect(overview).toContainText('model files');await expect(overview).toContainText('load');await expect(overview).toContainText('first answer');await expect(overview).toContainText('warm run');await expect(overview).toContainText('Downloads Off');
 await expect(page.getByRole('button',{name:'Run full model test',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Copy report for Codex'})).toHaveCount(0);
});

test('a legacy Performance restart marker still completes once after an update',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(navigator,'standalone',{configurable:true,value:true}));await openApp(page);await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('menuitem',{name:'Settings'}).click();await openSettingsItem(page,'Developer');await page.getByRole('button',{name:'Run tests',exact:true}).click();await expect(page.getByText('Checks saved · model test after restart',{exact:true})).toBeVisible();
 await page.evaluate(()=>{const key='babelshelf.device-test.offline-restart.v1',marker=JSON.parse(localStorage.getItem(key)!);marker.modelTestMode='performance';localStorage.setItem(key,JSON.stringify(marker));});await page.reload();await expect(page.getByRole('button',{name:'Copy report for Codex'})).toBeVisible();await expect(page.getByText('Test options · Performance',{exact:true})).toBeVisible();await expect.poll(()=>page.evaluate(()=>localStorage.getItem('babelshelf.device-test.offline-restart.v1'))).toBeNull();
});

test('a report-only run hides the previous report while checks are running',async({page})=>{
 await page.addInitScript(()=>{localStorage.setItem('babelshelf.device-test.report.v1',JSON.stringify({schema:1,createdAt:new Date().toISOString(),checks:[],modelGeneration:{status:'pass',model:'old',modelRevision:'old-rev',runtimeRevision:'old-runtime'}}));(window as any).__gpuProbeCount=0;const pending:Array<(value:null)=>void>=[];(window as any).__releaseGpuProbe=()=>pending.shift()?.(null);Object.defineProperty(navigator,'gpu',{configurable:true,value:{requestAdapter:()=>{(window as any).__gpuProbeCount++;return new Promise(resolve=>pending.push(resolve));}}});});
 await openApp(page);await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('menuitem',{name:'Settings'}).click();await openSettingsItem(page,'Developer');await page.getByRole('button',{name:'Run app checks',exact:true}).click();await expect(page.getByRole('button',{name:/Copy (current snapshot|report for Codex)/})).toHaveCount(0);await page.waitForFunction(()=>typeof (window as any).__releaseGpuProbe==='function'&&(window as any).__gpuProbeCount===1);await page.evaluate(()=>(window as any).__releaseGpuProbe());await page.waitForFunction(()=>(window as any).__gpuProbeCount===2);await page.evaluate(()=>(window as any).__releaseGpuProbe());await expect(page.getByRole('button',{name:'Copy report for Codex'})).toBeEnabled();
});
