import type {DeviceTestMode} from './device-model-test';
import type {DiagnosticLog} from './diagnostic-logs';
import {describeDiagnosticEnvironment,offlineRestartManualSteps,type OfflineRestartMarker,type ModelGenerationDiagnostic} from './device-diagnostics';

type Props={
 testMode:DeviceTestMode;onTestModeChange:(mode:DeviceTestMode)=>void;
 selectedModel?:string;modelAssetBytes?:number;modelFilesPresent:boolean;downloads:boolean;testStage:string;
 diagnosticBuild:string;
 bundle:string;
 deviceTestRunning:boolean;
 deviceModelTesting:boolean;
 deviceTestElapsedMs:number;
 onRunDeviceTest:()=>void;
 onStopModelTest:()=>void;
 offlineRestartMarker:OfflineRestartMarker|null;
 onCancelDeviceTest:()=>void;
 deviceTestReport:string;
 onCopyDeviceTestReport:()=>void;
 onClearDeviceTestReport:()=>void;
 diagnosticLogging:boolean;
 onDiagnosticLoggingChange:(enabled:boolean)=>void;
 onRefresh:()=>void;
 onReviewLogsInChat:()=>void;
 onClearLogs:()=>void;
 diagnosticLogs:DiagnosticLog[];
};

/** One shared Settings diagnostics surface for both app shells. */
export function DiagnosticsSettings(props:Props){
 const {testMode,onTestModeChange,selectedModel,modelAssetBytes,modelFilesPresent,downloads,testStage,diagnosticBuild,bundle,deviceTestRunning,deviceModelTesting,deviceTestElapsedMs,onRunDeviceTest,onStopModelTest,offlineRestartMarker,onCancelDeviceTest,deviceTestReport,onCopyDeviceTestReport,onClearDeviceTestReport,diagnosticLogging,onDiagnosticLoggingChange,onRefresh,onReviewLogsInChat,onClearLogs,diagnosticLogs}=props;
 let modelStatus='',reportAt='',reportBuild='',reportModel='',reportBackend='',reportEnvironment='',reportGpuHint='',reportContextTokens:number|undefined,reportTestContextTokens:number|undefined,reportConfiguredContextTokens:number|undefined,reportLogicalProcessors:number|undefined,reportMemoryEstimate:number|undefined,reportQuantization='';let generation:ModelGenerationDiagnostic|undefined,performanceSample=false,reportMode:DeviceTestMode|undefined,reportChecks:{id:string;status:'pass'|'fail'|'warning'|'not-run'}[]=[],reportModelFilesPresent:boolean|undefined;
 const failureLabels:Record<string,string>={'large-context-confirmation-required':'Large-context confirmation required','runtime-unavailable':'App runtime unavailable','runtime-messaging-unavailable':'Runtime communication failed','runtime-invalid-response':'Invalid runtime response','runtime-timeout':'Runtime setup timed out','runtime-assets-unavailable':'Runtime files unavailable','runtime-not-prepared':'Runtime not prepared','downloads-off':'Downloads are Off','offline-signal':'Browser reports Offline','runtime-http-error':'Runtime server request failed','runtime-network-error':'Runtime download failed','runtime-integrity-error':'Runtime file verification failed','runtime-storage-error':'Runtime cache write failed','runtime-setup-error':'Runtime setup failed','runtime-setup':'Runtime setup failed','model-preparation-error':'Model preparation failed','model-load-error':'Model load failed','count-error':'Input count failed','generation-error':'Generation failed','warm-generation-error':'Warm generation failed','output-validation-error':'Output check failed','unload-error':'Model cleanup failed'};
 try{const report=JSON.parse(deviceTestReport||'null');generation=report?.modelGeneration;reportModelFilesPresent=typeof report?.selectedModel?.filesPresent==='boolean'?report.selectedModel.filesPresent:undefined;reportChecks=Array.isArray(report?.checks)?report.checks.filter((item:any)=>item&&typeof item.id==='string'&&['pass','fail','warning','not-run'].includes(item.status)):[];reportMode=['app','offline-readiness','storage-health','runtime-support','model-readiness','quick','performance','full-cycle'].includes(report?.deviceTestMode)?report.deviceTestMode:!generation&&reportChecks.length?'app':undefined;
  performanceSample=generation?.testMode==='performance'||generation?.testMode==='full-cycle'||generation?.workload==='prose-128-v1'||generation?.workload==='prose-128-v2';
  if(typeof report?.createdAt==='string'&&Number.isFinite(Date.parse(report.createdAt)))reportAt=new Date(report.createdAt).toISOString();
  if(typeof report?.appBuild==='string')reportBuild=report.appBuild.slice(0,40);
  if(typeof report?.platform==='string'&&typeof report?.userAgent==='string')reportEnvironment=describeDiagnosticEnvironment(report.platform.slice(0,128),report.userAgent.slice(0,512));
  const gpuHint=report?.webgpu,vendors=['amd','apple','arm','google','intel','mediatek','microsoft','nvidia','qualcomm','samsung','other'];
  if(gpuHint?.available){const vendor=typeof gpuHint.vendor==='string'&&vendors.includes(gpuHint.vendor)?gpuHint.vendor:undefined,architecture=typeof gpuHint.architecture==='string'&&gpuHint.architecture.length<=48&&/^[a-z0-9]+(?:[._-][a-z0-9]+){0,5}$/.test(gpuHint.architecture)?gpuHint.architecture:undefined;reportGpuHint=[vendor,architecture].filter(Boolean).join(' · ');}
  if(report?.selectedModel?.backend==='webgpu'||report?.selectedModel?.backend==='cpu-wasm')reportBackend=report.selectedModel.backend;
  if(Number.isSafeInteger(report?.selectedModel?.contextTokens)&&report.selectedModel.contextTokens>=1&&report.selectedModel.contextTokens<=262144)reportContextTokens=report.selectedModel.contextTokens;
  const configuredContext=generation?.configuredContextTokens,testContext=generation?.testContextTokens;
  if(typeof configuredContext==='number'&&Number.isSafeInteger(configuredContext)&&configuredContext>=1&&configuredContext<=262144)reportConfiguredContextTokens=configuredContext;
  if(typeof testContext==='number'&&Number.isSafeInteger(testContext)&&testContext>=1&&testContext<=262144)reportTestContextTokens=testContext;
  if(Number.isSafeInteger(report?.hardware?.logicalProcessors)&&report.hardware.logicalProcessors>=1&&report.hardware.logicalProcessors<=256)reportLogicalProcessors=report.hardware.logicalProcessors;
  if(typeof report?.hardware?.memoryGiBEstimate==='number'&&Number.isFinite(report.hardware.memoryGiBEstimate)&&report.hardware.memoryGiBEstimate>=0.25&&report.hardware.memoryGiBEstimate<=1024)reportMemoryEstimate=report.hardware.memoryGiBEstimate;
  if(typeof generation?.quantization==='string')reportQuantization=generation.quantization.slice(0,100);
  else if(typeof report?.selectedModel?.quantization==='string')reportQuantization=report.selectedModel.quantization.slice(0,100);
  if(typeof generation?.model==='string')reportModel=generation.model.slice(0,120);
  else if(typeof report?.selectedModel?.id==='string')reportModel=report.selectedModel.id.slice(0,120);
  if(generation)modelStatus=failureLabels[generation.failureType??'']??(generation.failureType==='model-files-not-ready'?'Not prepared':generation.failureType==='restart-pending'?'After restart':generation.failureType==='incomplete-output'?'Incomplete output':generation.failureType==='empty-output'?'No output':generation.status==='fail'&&generation.failureStage?(failureLabels[generation.failureStage]??`Failed · ${generation.failureStage}`):generation.status==='stopped'&&generation.failureStage?`Stopped · ${generation.failureStage}`:generation.status==='pass'&&performanceSample?'Sample complete':({pass:'Passed',fail:'Failed','not-run':'Not run',stopped:'Stopped',interrupted:'Interrupted'} as Record<string,string>)[generation.status]??'Not run');
  else if(reportMode==='app')modelStatus='App checks complete';
  else if(reportMode==='model-readiness')modelStatus='Readiness checks complete';
 }catch{/* A broken local report must not break Settings. */}
 if(deviceTestRunning||deviceModelTesting)modelStatus=testStage||'Testing…';
 const restartSteps=offlineRestartMarker?offlineRestartManualSteps(typeof navigator==='undefined'?'Unknown':navigator.platform,typeof navigator==='undefined'?'Unknown':navigator.userAgent,offlineRestartMarker.baseline.standalone):[];
 const threadInfo=[typeof generation?.runtimeMetrics?.requestedThreads==='number'?`${generation.runtimeMetrics.requestedThreads} requested`:'',typeof generation?.runtimeMetrics?.runtimeThreads==='number'?`${generation.runtimeMetrics.runtimeThreads} reported`:'' ].filter(Boolean).join(' · ');
 const observedGpuLayers=generation?.runtimeMetrics?.runtimeObservedGpuLayers,observedGpuTotal=generation?.runtimeMetrics?.runtimeObservedGpuTotalLayers;
 const executionStatus=generation?.loadMetrics?.executionBackend==='webgpu'?`WebGPU${typeof observedGpuLayers==='number'&&typeof observedGpuTotal==='number'?` · ${observedGpuLayers}/${observedGpuTotal} GPU layers`:''}`:generation?.loadMetrics?.executionBackend==='cpu-wasm'?'CPU · WASM':reportBackend==='webgpu'?'GPU not confirmed':reportBackend==='cpu-wasm'?'CPU · WASM route':'Not reported';
 const fullCycleActive=testMode==='full-cycle'&&(deviceTestRunning||deviceModelTesting);
 const runtimeFailedBeforeModelPreparation=generation?.testMode==='full-cycle'&&generation.status==='fail'&&generation.failureStage==='runtime-setup'&&generation.assetState==='not-run'&&reportModelFilesPresent===false;
 const lfm3TestContextNote='Unloaded LFM3 tests use at most an 8K context, or the model’s lower configured context. Saved settings stay unchanged.';
 const testInfo:Record<DeviceTestMode,{label:string;overview:string;run:string;focus:string[]}>={
  app:{label:'App & storage',overview:'Check the app shell, cached build, local storage, Memory workflow and browser runtime signals. No model load or download.',run:'Run app checks',focus:['Secure context','Service worker','Installed launch','Build identity','Offline cache','Browser storage','Memory workflow','Model coordination','WASM runtime','GPU capability','Model files','Model reply','Offline restart']},
  'offline-readiness':{label:'Offline readiness',overview:'Review secure access, service worker, current build cache and install signals. A cold offline restart still needs a separate manual check.',run:'Check offline readiness',focus:['Secure context','Service worker','Installed launch','Build identity','Offline cache','Offline restart']},
  'storage-health':{label:'Storage health',overview:'Check temporary local storage, IndexedDB, OPFS, cache and Memory workflow probes. Probe data is removed; saved files are not opened or changed.',run:'Check storage',focus:['Offline cache','Browser storage','Memory workflow']},
  'runtime-support':{label:'Runtime support',overview:'Review WebGPU and WebAssembly prerequisites, model coordination and selected model files. Capability signals do not prove model execution or memory fit.',run:'Check runtime support',focus:['Model coordination','WASM runtime','GPU capability','Model files']},
  'model-readiness':{label:'Model readiness',overview:'Selected model · local file status · browser runtime prerequisites. No model load, generation, or download.',run:'Check model readiness',focus:['Model coordination','WASM runtime','GPU capability','Model files']},
  quick:{label:'Quick',overview:`App checks + one short reply from the selected model. If needed, Quick loads the prepared model into memory first. ${lfm3TestContextNote} Installed-app Quick may include a one-run restart check. No download.`,run:'Run tests',focus:['Model files','Model reply','Offline restart']},
  performance:{label:'Performance',overview:`App checks + one timing sample (up to 128 tokens). The selected model must already be prepared; it may still load into memory first. ${lfm3TestContextNote} No download.`,run:'Run speed sample',focus:['Model files','Model reply','WASM runtime','GPU capability']},
  'full-cycle':{label:'Full cycle',overview:`Prepare or verify the separate runtime first, then model files · load · first answer · warm run. ${lfm3TestContextNote}${modelFilesPresent?' Model files are ready.':downloads?' Missing runtime or model files may download while Downloads and Online are on.':' Missing runtime or model files will not download while Downloads are off.'}`,run:'Run full model test',focus:['Model files','Model reply','WASM runtime','GPU capability','Offline restart']}
 };
 const selectedTest=testInfo[testMode];
 const reportModeLabel=reportMode?testInfo[reportMode].label:generation?.testMode?testInfo[generation.testMode].label:performanceSample?'Performance':'';
 const groupStatus=(ids:string[],checks=reportChecks)=>{const found=checks.filter(item=>ids.includes(item.id));if(!found.length)return 'Not checked';if(found.some(item=>item.status==='fail'))return 'Failed';if(found.some(item=>item.status==='warning'))return 'Check';if(found.some(item=>item.status==='not-run'))return 'Partial';return 'Ready';};
 const resultOverview=reportMode?testInfo[reportMode]:generation?.testMode?testInfo[generation.testMode]:undefined;
 const resultMode=reportMode??generation?.testMode;
 const diagnosticGroups=[
  {label:'Secure context',ids:['secure-context'],description:'Secure page APIs required for local app features'},
  {label:'Service worker',ids:['service-worker'],description:'This page is controlled by the app worker'},
  {label:'Installed launch',ids:['home-screen-launch'],description:'Home Screen or installed-app display signal'},
  {label:'Build identity',ids:['app-build'],description:'Build currently controlling this page'},
  {label:'Offline cache',ids:['offline-cache'],description:'Current build cache listing; not a cold offline launch test'},
  {label:'Browser storage',ids:['storage-roundtrip','indexeddb-roundtrip','opfs-roundtrip','cache-roundtrip'],description:'Temporary local, database, file and cache read/write probes'},
  {label:'Memory workflow',ids:['memory-store-smoke'],description:'Temporary create, read, search, revise and cleanup path'},
  {label:'Model coordination',ids:['cross-tab-inference'],description:'Cross-tab lock support for shared model execution'},
  {label:'WASM runtime',ids:['wasm-threads'],description:'Shared WebAssembly prerequisites; runtime use is not proven'},
  {label:'GPU capability',ids:['webgpu'],description:'Browser GPU availability; model GPU use is not proven'},
  {label:'Model files',ids:['selected-model'],description:'Selected model files and load readiness'},
  {label:'Model reply',ids:[],description:'Local generation result, when a model test ran'},
  {label:'Offline restart',ids:['offline-cold-reopen','ios-system-state','os-system-state'],description:'Restart evidence; OS network and force-close actions cannot be verified by the app'},
 ];
 const fullCycleSteps=['Runtime','Model files','Load model','First answer','Warm run'];
 const overviewFor=(mode:DeviceTestMode|undefined,checks?:typeof reportChecks)=>{if(!mode)return'';const info=testInfo[mode],areas=diagnosticGroups.filter(group=>info.focus.includes(group.label));if(!checks)return `${areas.length} areas · ${areas.map(group=>group.label).join(' · ')}`;const ready=areas.filter(group=>groupStatus(group.ids,checks)==='Ready').length,review=areas.filter(group=>['Failed','Check','Partial'].includes(groupStatus(group.ids,checks))).length;return `${areas.length} areas · ${ready} ready${review?` · ${review} need review`:''}`;};
 const stage=testStage.toLowerCase();
 const activeStep=stage.includes('warm')?4:stage.includes('generating first answer')||stage.includes('test input')?3:stage.includes('loading model')?2:stage.includes('model file')||stage.includes('model asset')?1:0;
 const elapsedSeconds=Math.floor(deviceTestElapsedMs/1000),elapsedLabel=elapsedSeconds>=3600?`${Math.floor(elapsedSeconds/3600)}h ${String(Math.floor(elapsedSeconds%3600/60)).padStart(2,'0')}m`:`${Math.floor(elapsedSeconds/60)}m ${String(elapsedSeconds%60).padStart(2,'0')}s`;
 return <>
  <section aria-label="Device test">
   <h2>Device test</h2>
   <p className="source-revision">On-device app, storage and selected-model checks</p>
   <details className="device-test-steps"><summary>Test options · {selectedTest.label}</summary><div className="appearance-options" role="group" aria-label="Test type">{(['app','offline-readiness','storage-health','runtime-support','model-readiness','quick','performance','full-cycle'] as const).map(mode=><button key={mode} type="button" disabled={deviceTestRunning||deviceModelTesting||!!offlineRestartMarker} aria-pressed={testMode===mode} onClick={()=>onTestModeChange(mode)}>{testInfo[mode].label}</button>)}</div>{offlineRestartMarker&&<p className="source-revision">Restart check pending</p>}</details>
   <div className="device-test-overview" role="region" aria-label={`${selectedTest.label} overview`}><strong>{selectedTest.label}</strong><span>{selectedTest.overview}</span><span>{overviewFor(testMode)}</span>{testMode==='full-cycle'&&selectedModel&&<span>{modelFilesPresent?'Model files ready · no download expected':modelAssetBytes?`Selected model · ${(modelAssetBytes/1024**3).toFixed(2)} GB expected`:'Model files not ready'} · Downloads {downloads?'On':'Off'}</span>}</div>
   <button className="solid-button" disabled={deviceTestRunning||deviceModelTesting} onClick={offlineRestartMarker?onCancelDeviceTest:onRunDeviceTest}>{deviceTestRunning||deviceModelTesting?(testStage||'Testing…'):offlineRestartMarker?'Cancel test':selectedTest.run}</button>
   {!fullCycleActive&&(deviceTestRunning||deviceModelTesting)&&<div className="device-test-progress" role="status" aria-live="polite"><span>{testStage||`Starting ${selectedTest.label.toLowerCase()}…`}</span><time>{elapsedLabel} elapsed</time></div>}
   {fullCycleActive&&<div className="full-cycle-progress" role="status" aria-live="polite" aria-label="Full cycle progress"><div className="capability-row"><span>{testStage||'Starting full cycle…'}</span><time>{elapsedLabel} elapsed</time></div><div className="full-cycle-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={5} aria-valuenow={activeStep} aria-valuetext={`Step ${activeStep+1} of 5 · ${fullCycleSteps[activeStep]}`}>{fullCycleSteps.map((label,index)=><span key={label} className={index<activeStep?'complete':index===activeStep?'active':''} aria-hidden="true" />)}</div><div className="capability-row"><span>Step {activeStep+1} of 5 · {fullCycleSteps[activeStep]}</span><span>Time varies by model and connection</span></div></div>}
   {deviceModelTesting&&<button className="quiet-button" onClick={onStopModelTest}>Stop test</button>}
   {offlineRestartMarker&&<div className="device-offline-test"><h3>Restart needed</h3><p role="status">Checks saved · model test after restart</p><ol>{restartSteps.slice(1,2).map(step=><li key={step}>{step}</li>)}</ol><p className="source-revision">Tests continue automatically.</p></div>}
   {!deviceTestRunning&&!deviceModelTesting&&deviceTestReport&&<>
    <div className="capability-row"><span>Last test{reportModeLabel?` · ${reportModeLabel}`:''}</span>{reportAt&&<time dateTime={reportAt}>{new Date(reportAt).toLocaleString()}</time>}</div>
    {resultOverview&&<div className="device-test-overview" role="region" aria-label={`Last test overview · ${reportModeLabel||resultOverview.label}`}><strong>{reportModeLabel||resultOverview.label}</strong><span>{resultOverview.overview}</span><span>{overviewFor(resultMode,reportChecks)}</span>{generation&&<span>Model result · {modelStatus}</span>}{runtimeFailedBeforeModelPreparation&&<span>Runtime setup stopped before model preparation. Model files were not downloaded, and no model load or generation was tested.</span>}</div>}
    {reportBuild&&diagnosticBuild!=='Not checked'&&reportBuild!==diagnosticBuild&&<p className="source-revision" role="status">This report is from a different app build. Run the check again to verify the current build.</p>}
    {reportBuild&&<div className="capability-row"><span>Test build</span><span>{reportBuild}</span></div>}
    {reportEnvironment&&<div className="capability-row"><span>Test environment</span><span>{reportEnvironment}</span></div>}
   </>}
   {modelStatus&&<div className="capability-row"><span>Model</span><span>{!deviceTestRunning&&!deviceModelTesting&&reportModel?reportModel+' · ':''}{modelStatus}</span></div>}
   {!deviceTestRunning&&!deviceModelTesting&&generation&&performanceSample&&generation.status!=='not-run'&&<div className="capability-row"><span>Run on</span><span>{executionStatus}</span></div>}
   {!deviceTestRunning&&!deviceModelTesting&&generation&&performanceSample&&generation.status!=='not-run'&&generation.loadMetrics?.runtimeVariant&&<div className="capability-row"><span>WASM mode</span><span>{generation.loadMetrics.runtimeVariant==='compatibility'?'Compatibility':'Standard'}</span></div>}
   {!deviceTestRunning&&!deviceModelTesting&&generation?.loadMetrics?.gpuFallbackReason&&<div className="capability-row"><span>GPU fallback</span><span>{generation.loadMetrics.gpuFallbackReason==='webgpu-unavailable'?'WebGPU unavailable':generation.loadMetrics.gpuFallbackReason==='webgpu-no-layers-offloaded'?'GPU ran no model layers':'GPU model load failed'} · CPU/WASM used</span></div>}
   {!deviceTestRunning&&!deviceModelTesting&&generation&&performanceSample&&generation.status!=='not-run'&&<>
    {generation.testMode==='full-cycle'&&<>
     <div className="capability-row"><span>Assets</span><span>{generation.assetState==='prepared'?'Prepared during test':generation.assetState==='reused'?'Already prepared':'Not prepared'}</span></div>
     {typeof generation.preparationDurationMs==='number'&&<div className="capability-row"><span>Verify / prepare</span><span>{(generation.preparationDurationMs/1000).toFixed(1)} s</span></div>}
     {typeof generation.expectedModelBytes==='number'&&<div className="capability-row"><span>Model size · pinned</span><span>{(generation.expectedModelBytes/1024**2).toFixed(1)} MB</span></div>}
     {typeof generation.downloadedBytes==='number'&&<div className="capability-row"><span>Model downloaded</span><span>{(generation.downloadedBytes/1024**2).toFixed(1)} MB</span></div>}
     {typeof generation.runtimeDownloadedBytes==='number'&&<div className="capability-row"><span>Runtime downloaded</span><span>{(generation.runtimeDownloadedBytes/1024**2).toFixed(1)} MB</span></div>}
     {typeof generation.runtimeBytesRead==='number'&&<div className="capability-row"><span>Runtime bytes read</span><span>{(generation.runtimeBytesRead/1024**2).toFixed(1)} MB · includes cache</span></div>}
     {typeof generation.runtimePreparationDurationMs==='number'&&<div className="capability-row"><span>Runtime check / setup</span><span>{(generation.runtimePreparationDurationMs/1000).toFixed(1)} s</span></div>}
     {typeof generation.modelStartToFirstTextMs==='number'&&<div className="capability-row"><span>Run → first text</span><span>{(generation.modelStartToFirstTextMs/1000).toFixed(1)} s</span></div>}
     {typeof generation.warmTokensPerSecond==='number'&&<div className="capability-row"><span>Warm speed</span><span>{generation.warmTokensPerSecond.toFixed(2)} tokens/s</span></div>}
    </>}
    <div className="capability-row"><span>Model load</span><span>{generation.loadState==='already-loaded'?'Already loaded':generation.loadState==='not-loaded'?'Not loaded':typeof generation.loadDurationMs==='number'?(generation.loadDurationMs/1000).toFixed(1)+' s':'—'}</span></div>
    {typeof generation.runtimeMetrics?.visibleTextTtftMs==='number'&&<div className="capability-row"><span>Runtime · first text</span><span>{(generation.runtimeMetrics.visibleTextTtftMs/1000).toFixed(2)} s</span></div>}
    {typeof generation.tokensPerSecond==='number'&&<div className="capability-row"><span>Overall speed</span><span>{generation.tokensPerSecond.toFixed(2)} tokens/s</span></div>}
    {typeof generation.runtimeMetrics?.runtimeDecodeTokensPerSecond==='number'&&<div className="capability-row"><span>Decode speed</span><span>{generation.runtimeMetrics.runtimeDecodeTokensPerSecond.toFixed(2)} tokens/s</span></div>}
    <details className="device-test-steps"><summary>Technical details</summary>
     {reportQuantization&&<div className="capability-row"><span>Quantization</span><span>{reportQuantization}</span></div>}
     {reportBackend&&<div className="capability-row"><span>Backend route · configured</span><span>{reportBackend==='webgpu'?'WebGPU':'CPU · WASM'}</span></div>}
     {reportGpuHint&&<div className="capability-row"><span>GPU hint · browser</span><span>{reportGpuHint}</span></div>}
     {typeof reportLogicalProcessors==='number'&&<div className="capability-row"><span>Logical processors · browser</span><span>{reportLogicalProcessors}</span></div>}
     {typeof reportMemoryEstimate==='number'&&<div className="capability-row"><span>Memory estimate · browser</span><span>{reportMemoryEstimate.toLocaleString('en',{maximumFractionDigits:2})} GiB</span></div>}
     {threadInfo&&<div className="capability-row"><span>Threads · runtime</span><span>{threadInfo}</span></div>}
     {typeof generation.runtimeMetrics?.runtimePrefillMs==='number'&&<div className="capability-row"><span>Prompt processing · runtime</span><span>{(generation.runtimeMetrics.runtimePrefillMs/1000).toFixed(2)} s</span></div>}
     {typeof generation.inputTokens==='number'&&<div className="capability-row"><span>Input</span><span>{generation.inputTokens} tokens</span></div>}
     {typeof reportContextTokens==='number'&&<div className="capability-row"><span>Context limit · configured</span><span>{reportContextTokens.toLocaleString()} tokens</span></div>}
     {typeof reportTestContextTokens==='number'&&reportConfiguredContextTokens!==undefined&&reportTestContextTokens!==reportConfiguredContextTokens&&<div className="capability-row"><span>Test context</span><span>{reportTestContextTokens.toLocaleString()} · saved {reportConfiguredContextTokens.toLocaleString()}</span></div>}
     {typeof generation.runtimeMetrics?.memoryAfter?.liveBytes==='number'&&<div className="capability-row"><span>Runtime memory</span><span>{Math.round(generation.runtimeMetrics.memoryAfter.liveBytes/1048576)} MiB</span></div>}
     {typeof generation.outputTokens==='number'&&<div className="capability-row"><span>Output</span><span>{generation.outputTokens} tokens</span></div>}
    </details>
   </>}
   {deviceTestReport&&<><div className="action-row"><button className="quiet-button" onClick={onCopyDeviceTestReport}>{deviceTestRunning||deviceModelTesting?"Copy current snapshot":"Copy report for Codex"}</button><button className="quiet-button" disabled={deviceTestRunning||deviceModelTesting||!!offlineRestartMarker} onClick={onClearDeviceTestReport}>Clear report</button></div><details className="device-test-report"><summary>{deviceTestRunning||deviceModelTesting?'Previous report':'Report'}</summary><pre className="diagnostic-report">{deviceTestReport}</pre></details></>}
   {deviceTestReport&&<section className="device-test-steps diagnostic-results" aria-label={`Check results · ${diagnosticGroups.length} areas`}><h3>Check results</h3>{diagnosticGroups.map(group=><div className="diagnostic-result" key={group.label}><div className="capability-row"><strong>{group.label}</strong><span>{group.label==='Model reply'?(generation?modelStatus:'Not run'):groupStatus(group.ids)}</span></div><p className="source-revision">{group.description}</p></div>)}<p className="source-revision">A listed cache does not prove an offline launch. WebGPU availability does not prove that the selected model used the GPU.</p></section>}
   <details className="device-test-steps"><summary>Test guide</summary><p className="source-revision">App & storage checks cache, browser storage, Memory storage and runtime prerequisites without loading a model.</p><p className="source-revision">Offline readiness summarizes app install and cache signals. Storage health summarizes temporary local storage probes. Runtime support summarizes browser prerequisites and model file status. All checks remain on this device; they do not run a model.</p><p className="source-revision">Quick runs one short structured reply from the selected model and loads it into memory first if needed. Performance runs one bounded timing sample and also loads it first if needed. Neither downloads model files. If an LFM3 model is not loaded, these tests use 8K to limit startup time. Your saved context setting does not change. A model already loaded is tested at its current context.</p><p className="source-revision">You can move to another BabelShelf screen while a check runs. The check continues and its status stays visible.</p><p className="source-revision">Full cycle checks or prepares the separate runtime first, then prepares or verifies model files, loads the model, measures first text and runs a warm sample. Downloads happen only if files are missing, Downloads are On and the browser reports Online. A verified cached runtime is reused.</p><p className="source-revision">Installed-app restart checks must start from the installed app, not a browser tab. A tab cannot prove a cold offline restart. Test replies are discarded.</p></details>
   <details className="device-test-steps"><summary>Limits</summary><p className="source-revision">Disconnecting the network and closing the app need your action. The app cannot verify those OS-level actions.</p><p className="source-revision">Overall speed includes input processing. Decode speed is reported by the runtime when available. Downloaded bytes are exact only for runtimes that report streamed transfer bytes.</p><p className="source-revision">One run does not establish answer quality, long use, heat or broad device compatibility.</p></details>
  </section>
  <section aria-label="App build">
   <div className="capability-row"><span>Active worker</span><span>{diagnosticBuild}</span></div>
   <div className="capability-row"><span>Page bundle</span><span>{bundle}</span></div>
  </section>
  <section aria-label="Diagnostic logging">
   <label className="setting-row"><span>Detailed logs · {diagnosticLogging?'On':'Off'}</span><input type="checkbox" role="switch" checked={diagnosticLogging} onChange={event=>onDiagnosticLoggingChange(event.target.checked)}/></label>
   <p className="source-revision">On this device. New errors only. No prompts or files.</p>
   <div className="action-row"><button className="quiet-button" onClick={onRefresh}>Refresh</button><button className="quiet-button" disabled={!diagnosticLogs.length} onClick={onReviewLogsInChat}>Review with model</button><button className="quiet-button" disabled={!diagnosticLogs.length} onClick={onClearLogs}>Clear logs</button></div>
  </section>
  <section aria-label="Diagnostic entries">{diagnosticLogs.length?diagnosticLogs.slice().reverse().map(entry=><details className="activity-entry" key={entry.id}><summary>{entry.tool} · {entry.status}</summary><div className="source-revision">{new Date(entry.at).toLocaleString()} · {entry.code}</div><div className="file-body">{entry.message}</div></details>):<div className="empty-state">No diagnostic logs</div>}</section>
 </>;
}
