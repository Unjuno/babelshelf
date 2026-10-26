import type {DeviceTestMode} from './device-model-test';
import type {DiagnosticLog} from './diagnostic-logs';
import type {OfflineRestartMarker,ModelGenerationDiagnostic} from './device-diagnostics';

type Props={
 testMode:DeviceTestMode;onTestModeChange:(mode:DeviceTestMode)=>void;
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
 const {testMode,onTestModeChange,diagnosticBuild,bundle,deviceTestRunning,deviceModelTesting,onRunDeviceTest,onStopModelTest,offlineRestartMarker,onCancelDeviceTest,deviceTestReport,onCopyDeviceTestReport,onClearDeviceTestReport,diagnosticLogging,onDiagnosticLoggingChange,onRefresh,onReviewLogsInChat,onClearLogs,diagnosticLogs}=props;
 let modelStatus='',reportAt='',reportBuild='',reportModel='';let generation:ModelGenerationDiagnostic|undefined;
 try{const report=JSON.parse(deviceTestReport||'null');generation=report?.modelGeneration;
  if(typeof report?.createdAt==='string'&&Number.isFinite(Date.parse(report.createdAt)))reportAt=new Date(report.createdAt).toISOString();
  if(typeof report?.appBuild==='string')reportBuild=report.appBuild.slice(0,40);
  if(typeof generation?.model==='string')reportModel=generation.model.slice(0,120);
  else if(typeof report?.selectedModel?.id==='string')reportModel=report.selectedModel.id.slice(0,120);
  if(generation)modelStatus=generation.failureType==='model-files-not-ready'?'Not prepared':generation.failureType==='restart-pending'?'After restart':({pass:'Passed',fail:'Failed','not-run':'Not run',stopped:'Stopped',interrupted:'Interrupted'} as Record<string,string>)[generation.status]??'Not run';
 }catch{/* A broken local report must not break Settings. */}
 if(deviceTestRunning||deviceModelTesting)modelStatus='Testing…';
 return <>
  <section aria-label="Device test">
   <h2>Device test</h2>
   <p className="source-revision">App + selected model. Local files only.</p>
   <details className="device-test-steps"><summary>Test options · {testMode==='performance'?'Performance':'Quick'}</summary><div className="appearance-options" role="group" aria-label="Test mode">{(['quick','performance'] as const).map(mode=><button key={mode} type="button" disabled={deviceTestRunning||deviceModelTesting||!!offlineRestartMarker} aria-pressed={testMode===mode} onClick={()=>onTestModeChange(mode)}>{mode==='quick'?'Quick':'Performance'}</button>)}</div><p className="source-revision">{offlineRestartMarker?'Restart check pending':testMode==='performance'?'Runs here · No restart · Up to 128 tokens · More battery':'App + model · Home Screen app: restart check'}</p></details>
   <button className="solid-button" disabled={deviceTestRunning||deviceModelTesting} onClick={offlineRestartMarker?onCancelDeviceTest:onRunDeviceTest}>{deviceTestRunning||deviceModelTesting?'Testing…':offlineRestartMarker?'Cancel test':'Run tests'}</button>
   {deviceModelTesting&&<button className="quiet-button" onClick={onStopModelTest}>Stop test</button>}
   {offlineRestartMarker&&<div className="device-offline-test"><h3>Restart needed</h3><p role="status">Checks saved · model test after restart</p><ol><li>Turn on Airplane Mode.</li><li>Close BabelShelf.</li><li>Open from the Home Screen.</li></ol><p className="source-revision">Tests continue automatically.</p></div>}
   {!deviceTestRunning&&!deviceModelTesting&&deviceTestReport&&<>
    <div className="capability-row"><span>Last test{generation?.testMode==='performance'?' · Performance':generation?.testMode==='quick'?' · Quick':''}</span>{reportAt&&<time dateTime={reportAt}>{new Date(reportAt).toLocaleString()}</time>}</div>
    {reportBuild&&<div className="capability-row"><span>Test build</span><span>{reportBuild}</span></div>}
   </>}
   {modelStatus&&<div className="capability-row"><span>Model</span><span>{!deviceTestRunning&&!deviceModelTesting&&reportModel?reportModel+' · ':''}{modelStatus}</span></div>}
   {!deviceTestRunning&&!deviceModelTesting&&generation?.testMode==='performance'&&generation.status!=='not-run'&&<><div className="capability-row"><span>Load</span><span>{generation.loadState==='already-loaded'?'Already loaded':typeof generation.loadDurationMs==='number'?(generation.loadDurationMs/1000).toFixed(1)+' s':'—'}</span></div>{typeof generation.runtimeMetrics?.visibleTextTtftMs==='number'&&<div className="capability-row"><span>First token</span><span>{(generation.runtimeMetrics.visibleTextTtftMs/1000).toFixed(2)} s</span></div>}{typeof generation.tokensPerSecond==='number'&&<div className="capability-row"><span>Generation</span><span>{generation.tokensPerSecond.toFixed(2)} tokens/s</span></div>}{typeof generation.inputTokens==='number'&&<div className="capability-row"><span>Input</span><span>{generation.inputTokens} tokens</span></div>}{typeof generation.runtimeMetrics?.memoryAfter?.liveBytes==='number'&&<div className="capability-row"><span>Runtime memory</span><span>{Math.round(generation.runtimeMetrics.memoryAfter.liveBytes/1048576)} MiB</span></div>}{typeof generation.outputTokens==='number'&&<div className="capability-row"><span>Output</span><span>{generation.outputTokens} tokens</span></div>}</>}
   {deviceTestReport&&<><div className="action-row"><button className="quiet-button" disabled={deviceTestRunning||deviceModelTesting} onClick={onCopyDeviceTestReport}>Copy report for Codex</button><button className="quiet-button" disabled={deviceTestRunning||deviceModelTesting||!!offlineRestartMarker} onClick={onClearDeviceTestReport}>Clear report</button></div><details className="device-test-report"><summary>{deviceTestRunning||deviceModelTesting?'Previous report':'Report'}</summary><pre className="diagnostic-report">{deviceTestReport}</pre></details></>}
   <details className="device-test-steps"><summary>Checks</summary><p className="source-revision">App, storage, Memory, GPU and one short model reply. Unprepared models are skipped.</p><p className="source-revision">Restart: Home Screen app only. Browser tabs finish without a restart check.</p><p className="source-revision">Uses model memory. No downloads. Test reply is discarded.</p></details>
   <details className="device-test-steps"><summary>Limits</summary><p className="source-revision">Airplane Mode and closing the app need your action. The app cannot verify those actions.</p><p className="source-revision">This is not a test of answer quality, long use or heat.</p></details>
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
