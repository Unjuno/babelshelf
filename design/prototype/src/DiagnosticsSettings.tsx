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
 const {testMode,onTestModeChange,selectedModel,modelAssetBytes,modelFilesPresent,downloads,testStage,diagnosticBuild,bundle,deviceTestRunning,deviceModelTesting,onRunDeviceTest,onStopModelTest,offlineRestartMarker,onCancelDeviceTest,deviceTestReport,onCopyDeviceTestReport,onClearDeviceTestReport,diagnosticLogging,onDiagnosticLoggingChange,onRefresh,onReviewLogsInChat,onClearLogs,diagnosticLogs}=props;
 let modelStatus='',reportAt='',reportBuild='',reportModel='',reportBackend='',reportEnvironment='',reportGpuHint='',reportContextTokens:number|undefined,reportLogicalProcessors:number|undefined,reportMemoryEstimate:number|undefined,reportQuantization='';let generation:ModelGenerationDiagnostic|undefined,performanceSample=false;
 try{const report=JSON.parse(deviceTestReport||'null');generation=report?.modelGeneration;
  performanceSample=generation?.testMode==='performance'||generation?.testMode==='full-cycle'||generation?.workload==='prose-128-v1'||generation?.workload==='prose-128-v2';
  if(typeof report?.createdAt==='string'&&Number.isFinite(Date.parse(report.createdAt)))reportAt=new Date(report.createdAt).toISOString();
  if(typeof report?.appBuild==='string')reportBuild=report.appBuild.slice(0,40);
  if(typeof report?.platform==='string'&&typeof report?.userAgent==='string')reportEnvironment=describeDiagnosticEnvironment(report.platform.slice(0,128),report.userAgent.slice(0,512));
  const gpuHint=report?.webgpu,vendors=['amd','apple','arm','google','intel','mediatek','microsoft','nvidia','qualcomm','samsung','other'];
  if(gpuHint?.available){const vendor=typeof gpuHint.vendor==='string'&&vendors.includes(gpuHint.vendor)?gpuHint.vendor:undefined,architecture=typeof gpuHint.architecture==='string'&&gpuHint.architecture.length<=48&&/^[a-z0-9]+(?:[._-][a-z0-9]+){0,5}$/.test(gpuHint.architecture)?gpuHint.architecture:undefined;reportGpuHint=[vendor,architecture].filter(Boolean).join(' · ');}
  if(report?.selectedModel?.backend==='webgpu'||report?.selectedModel?.backend==='cpu-wasm')reportBackend=report.selectedModel.backend;
  if(Number.isSafeInteger(report?.selectedModel?.contextTokens)&&report.selectedModel.contextTokens>=1&&report.selectedModel.contextTokens<=262144)reportContextTokens=report.selectedModel.contextTokens;
  if(Number.isSafeInteger(report?.hardware?.logicalProcessors)&&report.hardware.logicalProcessors>=1&&report.hardware.logicalProcessors<=256)reportLogicalProcessors=report.hardware.logicalProcessors;
  if(typeof report?.hardware?.memoryGiBEstimate==='number'&&Number.isFinite(report.hardware.memoryGiBEstimate)&&report.hardware.memoryGiBEstimate>=0.25&&report.hardware.memoryGiBEstimate<=1024)reportMemoryEstimate=report.hardware.memoryGiBEstimate;
  if(typeof generation?.quantization==='string')reportQuantization=generation.quantization.slice(0,100);
  else if(typeof report?.selectedModel?.quantization==='string')reportQuantization=report.selectedModel.quantization.slice(0,100);
  if(typeof generation?.model==='string')reportModel=generation.model.slice(0,120);
  else if(typeof report?.selectedModel?.id==='string')reportModel=report.selectedModel.id.slice(0,120);
  if(generation)modelStatus=generation.failureType==='model-files-not-ready'?'Not prepared':generation.failureType==='restart-pending'?'After restart':generation.failureType==='incomplete-output'?'Incomplete output':generation.failureType==='empty-output'?'No output':generation.status==='fail'&&generation.failureStage?`Failed · ${generation.failureStage}`:generation.status==='pass'&&performanceSample?'Sample complete':({pass:'Passed',fail:'Failed','not-run':'Not run',stopped:'Stopped',interrupted:'Interrupted'} as Record<string,string>)[generation.status]??'Not run';
 }catch{/* A broken local report must not break Settings. */}
 if(deviceTestRunning||deviceModelTesting)modelStatus=testStage||'Testing…';
 const restartSteps=offlineRestartMarker?offlineRestartManualSteps(typeof navigator==='undefined'?'Unknown':navigator.platform,typeof navigator==='undefined'?'Unknown':navigator.userAgent,offlineRestartMarker.baseline.standalone):[];
 const threadInfo=[typeof generation?.runtimeMetrics?.requestedThreads==='number'?`${generation.runtimeMetrics.requestedThreads} requested`:'',typeof generation?.runtimeMetrics?.runtimeThreads==='number'?`${generation.runtimeMetrics.runtimeThreads} reported`:'' ].filter(Boolean).join(' · ');
 const observedGpuLayers=generation?.runtimeMetrics?.runtimeObservedGpuLayers,observedGpuTotal=generation?.runtimeMetrics?.runtimeObservedGpuTotalLayers;
 const executionStatus=generation?.loadMetrics?.executionBackend==='webgpu'?`WebGPU${typeof observedGpuLayers==='number'&&typeof observedGpuTotal==='number'?` · ${observedGpuLayers}/${observedGpuTotal} GPU layers`:''}`:generation?.loadMetrics?.executionBackend==='cpu-wasm'?'CPU · WASM':reportBackend==='webgpu'?'GPU not confirmed':reportBackend==='cpu-wasm'?'CPU · WASM route':'Not reported';
 return <>
  <section aria-label="Device test">
   <h2>Device test</h2>
   <p className="source-revision">App + selected model · local inference</p>
   <details className="device-test-steps"><summary>Test options · {testMode==='performance'?'Performance':testMode==='full-cycle'?'Full cycle':'Quick'}</summary><div className="appearance-options" role="group" aria-label="Test mode">{(['quick','performance','full-cycle'] as const).map(mode=><button key={mode} type="button" disabled={deviceTestRunning||deviceModelTesting||!!offlineRestartMarker} aria-pressed={testMode===mode} onClick={()=>onTestModeChange(mode)}>{mode==='quick'?'Quick':mode==='performance'?'Performance':'Full cycle'}</button>)}</div><p className="source-revision">{offlineRestartMarker?'Restart check pending':testMode==='performance'?'Prepared model · one timing sample · no restart':testMode==='full-cycle'?`Prepare if missing · load · first text · warm run${!modelFilesPresent&&downloads?' · Online may use data':''}`:'App + model · Installed app: restart check'}</p>{testMode==='full-cycle'&&selectedModel&&<p className="source-revision">{modelFilesPresent?'Model files ready · no download expected':modelAssetBytes?`Selected model · ${(modelAssetBytes/1024**3).toFixed(2)} GB expected`:'Model files not ready'} · Downloads {downloads?'On':'Off'}</p>}</details>
   <button className="solid-button" disabled={deviceTestRunning||deviceModelTesting} onClick={offlineRestartMarker?onCancelDeviceTest:onRunDeviceTest}>{deviceTestRunning||deviceModelTesting?(testStage||'Testing…'):offlineRestartMarker?'Cancel test':testMode==='performance'?'Run speed sample':testMode==='full-cycle'?'Run full model test':'Run tests'}</button>
   {deviceModelTesting&&<button className="quiet-button" onClick={onStopModelTest}>Stop test</button>}
   {offlineRestartMarker&&<div className="device-offline-test"><h3>Restart needed</h3><p role="status">Checks saved · model test after restart</p><ol>{restartSteps.slice(1,2).map(step=><li key={step}>{step}</li>)}</ol><p className="source-revision">Tests continue automatically.</p></div>}
   {!deviceTestRunning&&!deviceModelTesting&&deviceTestReport&&<>
    <div className="capability-row"><span>Last test{generation?.testMode==='full-cycle'?' · Full cycle':performanceSample?' · Performance':generation?.testMode==='quick'?' · Quick':''}</span>{reportAt&&<time dateTime={reportAt}>{new Date(reportAt).toLocaleString()}</time>}</div>
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
     {typeof generation.runtimePreparationDurationMs==='number'&&<div className="capability-row"><span>Runtime check / setup</span><span>{(generation.runtimePreparationDurationMs/1000).toFixed(1)} s</span></div>}
     {typeof generation.modelStartToFirstTextMs==='number'&&<div className="capability-row"><span>Run → first text</span><span>{(generation.modelStartToFirstTextMs/1000).toFixed(1)} s</span></div>}
     {typeof generation.warmTokensPerSecond==='number'&&<div className="capability-row"><span>Warm speed</span><span>{generation.warmTokensPerSecond.toFixed(2)} tokens/s</span></div>}
    </>}
    <div className="capability-row"><span>Model load</span><span>{generation.loadState==='already-loaded'?'Already loaded':generation.loadState==='not-loaded'?'Not loaded':typeof generation.loadDurationMs==='number'?(generation.loadDurationMs/1000).toFixed(1)+' s':'—'}</span></div>
    {typeof generation.runtimeMetrics?.visibleTextTtftMs==='number'&&<div className="capability-row"><span>First text</span><span>{(generation.runtimeMetrics.visibleTextTtftMs/1000).toFixed(2)} s</span></div>}
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
     {typeof generation.runtimeMetrics?.memoryAfter?.liveBytes==='number'&&<div className="capability-row"><span>Runtime memory</span><span>{Math.round(generation.runtimeMetrics.memoryAfter.liveBytes/1048576)} MiB</span></div>}
     {typeof generation.outputTokens==='number'&&<div className="capability-row"><span>Output</span><span>{generation.outputTokens} tokens</span></div>}
    </details>
   </>}
   {deviceTestReport&&<><div className="action-row"><button className="quiet-button" disabled={deviceTestRunning||deviceModelTesting} onClick={onCopyDeviceTestReport}>Copy report for Codex</button><button className="quiet-button" disabled={deviceTestRunning||deviceModelTesting||!!offlineRestartMarker} onClick={onClearDeviceTestReport}>Clear report</button></div><details className="device-test-report"><summary>{deviceTestRunning||deviceModelTesting?'Previous report':'Report'}</summary><pre className="diagnostic-report">{deviceTestReport}</pre></details></>}
   <details className="device-test-steps"><summary>Checks</summary><p className="source-revision">Quick checks app, storage, Memory and one short reply. Performance measures one prepared-model timing sample.</p><p className="source-revision">Full cycle prepares or verifies the selected model, loads it, measures first text and runs a warm sample. Model files stay on this device.</p><p className="source-revision">Quick and Performance never download. Full cycle downloads only if the selected model is missing, Downloads are On and the browser reports Online.</p><p className="source-revision">Restart: installed app only. Browser tabs finish without a restart check. Test replies are discarded.</p></details>
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
