import type {DiagnosticLog} from './diagnostic-logs';
import type {OfflineRestartMarker} from './device-diagnostics';

type Props={
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
 const {diagnosticBuild,bundle,deviceTestRunning,deviceModelTesting,onRunDeviceTest,onStopModelTest,offlineRestartMarker,onCancelDeviceTest,deviceTestReport,onCopyDeviceTestReport,onClearDeviceTestReport,diagnosticLogging,onDiagnosticLoggingChange,onRefresh,onReviewLogsInChat,onClearLogs,diagnosticLogs}=props;
 let modelStatus='';
 try{const generation=JSON.parse(deviceTestReport||'null')?.modelGeneration;if(generation)modelStatus=generation.failureType==='model-files-not-ready'?'Not prepared':generation.failureType==='restart-pending'?'After restart':({pass:'Passed',fail:'Failed','not-run':'Not run',stopped:'Stopped',interrupted:'Interrupted'} as Record<string,string>)[generation.status]??'Not run';}catch{/* A broken local report must not break Settings. */}
 return <>
  <section aria-label="Device test">
   <h2>Device test</h2>
   <p className="source-revision">App + selected model. Local files only.</p>
   <button className="solid-button" disabled={deviceTestRunning||deviceModelTesting} onClick={offlineRestartMarker?onCancelDeviceTest:onRunDeviceTest}>{deviceTestRunning||deviceModelTesting?'Testing…':offlineRestartMarker?'Cancel test':'Run tests'}</button>
   {deviceModelTesting&&<button className="quiet-button" onClick={onStopModelTest}>Stop test</button>}
   {offlineRestartMarker&&<div className="device-offline-test"><h3>Restart needed</h3><p role="status">Checks saved · model test after restart</p><ol><li>Turn on Airplane Mode.</li><li>Close BabelShelf.</li><li>Open from the Home Screen.</li></ol><p className="source-revision">Tests continue automatically.</p></div>}
   {modelStatus&&<div className="capability-row"><span>Model</span><span>{modelStatus}</span></div>}
   {deviceTestReport&&<><div className="action-row"><button className="quiet-button" onClick={onCopyDeviceTestReport}>Copy report for Codex</button><button className="quiet-button" disabled={deviceTestRunning||deviceModelTesting||!!offlineRestartMarker} onClick={onClearDeviceTestReport}>Clear report</button></div><details className="device-test-report"><summary>Report</summary><pre className="diagnostic-report">{deviceTestReport}</pre></details></>}
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
