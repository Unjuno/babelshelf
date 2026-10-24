import type {DiagnosticLog} from './diagnostic-logs';
import type {OfflineRestartMarker} from './device-diagnostics';

type Props={
 diagnosticBuild:string;
 bundle:string;
 deviceTestRunning:boolean;
 deviceModelTesting:boolean;
 canRunModelTest:boolean;
 canSelectModelForRestart:boolean;
 onRunDeviceTest:()=>void;
 onStopModelTest:()=>void;
 onRunModelTest:()=>void;
 includeModelTestAfterRestart:boolean;
 onIncludeModelTestAfterRestart:(enabled:boolean)=>void;
 offlineRestartMarker:OfflineRestartMarker|null;
 onStartOfflineRestartTest:()=>void;
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
 const {diagnosticBuild,bundle,deviceTestRunning,deviceModelTesting,canRunModelTest,canSelectModelForRestart,onRunDeviceTest,onStopModelTest,onRunModelTest,includeModelTestAfterRestart,onIncludeModelTestAfterRestart,offlineRestartMarker,onStartOfflineRestartTest,deviceTestReport,onCopyDeviceTestReport,onClearDeviceTestReport,diagnosticLogging,onDiagnosticLoggingChange,onRefresh,onReviewLogsInChat,onClearLogs,diagnosticLogs}=props;
 return <>
  <section aria-label="App build">
   <div className="capability-row"><span>Active worker</span><span>{diagnosticBuild}</span></div>
   <div className="capability-row"><span>Page bundle</span><span>{bundle}</span></div>
  </section>
  <section aria-label="Device test">
   <h2>Device test</h2>
   <p className="source-revision">Temporary test. Your files stay untouched.</p>
   <button className="solid-button" disabled={deviceTestRunning||deviceModelTesting} onClick={onRunDeviceTest}>{deviceTestRunning||deviceModelTesting?'Checking…':'Run device test'}</button>
   {deviceModelTesting&&<button className="quiet-button" onClick={onStopModelTest}>Stop test</button>}
   <details className="device-test-steps"><summary>Checks</summary><p className="source-revision">App, storage, Memory, GPU and worker support. No model runs.</p></details>
   <button className="quiet-button" disabled={!canRunModelTest||deviceModelTesting||deviceTestRunning} onClick={onRunModelTest}>Test selected model</button>
   <p className="source-revision">Loads the selected model. Uses memory. Test reply is discarded.</p>
   <p className="source-revision">Unload Decision first if it is loaded.</p>
   <label className="setting-row"><span>Test model after restart</span><input type="checkbox" checked={includeModelTestAfterRestart} disabled={!canSelectModelForRestart||deviceModelTesting||deviceTestRunning} onChange={event=>onIncludeModelTestAfterRestart(event.target.checked)}/></label>
   <details className="device-test-steps"><summary>About model tests</summary><p className="source-revision">Off by default. Uses the same selected model after restart, only when its files are ready.</p></details>
   <div className="device-offline-test"><h3>Offline restart test</h3>{offlineRestartMarker?<p role="status">Test started · {new Date(offlineRestartMarker.startedAt).toLocaleString()}</p>:<><p className="source-revision">Open from the Home Screen. Use the same app both times.</p><p className="source-revision">Safari and the Home Screen app can use separate data.</p><button className="quiet-button" disabled={deviceTestRunning||deviceModelTesting} onClick={onStartOfflineRestartTest}>Start restart test</button></>}</div>
   {deviceTestReport&&<><div className="action-row"><button className="quiet-button" onClick={onCopyDeviceTestReport}>Copy report for Codex</button><button className="quiet-button" onClick={onClearDeviceTestReport}>Clear report</button></div><details className="device-test-report"><summary>Report · {new Date(JSON.parse(deviceTestReport).createdAt).toLocaleString()}</summary><pre className="diagnostic-report">{deviceTestReport}</pre></details></>}
   <details className="device-test-steps"><summary>Restart steps</summary><ol><li>Turn on Airplane Mode. Close BabelShelf.</li><li>Open it from the Home Screen. Then copy the report for Codex.</li></ol></details>
   <details className="device-test-steps"><summary>What this check cannot test</summary><p className="source-revision">The app cannot check Airplane Mode or force-close. Network status cannot prove an offline restart.</p><p className="source-revision">It does not test answer quality, speed, or heat.</p></details>
  </section>
  <section aria-label="Diagnostic logging">
   <label className="setting-row"><span>Detailed logs · {diagnosticLogging?'On':'Off'}</span><input type="checkbox" role="switch" checked={diagnosticLogging} onChange={event=>onDiagnosticLoggingChange(event.target.checked)}/></label>
   <p className="source-revision">On this device. New errors only. No prompts or files.</p>
   <div className="action-row"><button className="quiet-button" onClick={onRefresh}>Refresh</button><button className="quiet-button" disabled={!diagnosticLogs.length} onClick={onReviewLogsInChat}>Review with model</button><button className="quiet-button" disabled={!diagnosticLogs.length} onClick={onClearLogs}>Clear logs</button></div>
  </section>
  <section aria-label="Diagnostic entries">{diagnosticLogs.length?diagnosticLogs.slice().reverse().map(entry=><details className="activity-entry" key={entry.id}><summary>{entry.tool} · {entry.status}</summary><div className="source-revision">{new Date(entry.at).toLocaleString()} · {entry.code}</div><div className="file-body">{entry.message}</div></details>):<div className="empty-state">No diagnostic logs</div>}</section>
 </>;
}
