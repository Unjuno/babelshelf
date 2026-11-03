import type {DeviceModelTestMode,DeviceTestMode} from './device-model-test.ts';
import {offlineRestartManualSteps,type DeviceDiagnosticReport,type OfflineRestartMarker} from './device-diagnostics.ts';
type Ports={collect:()=>Promise<DeviceDiagnosticReport>;save:(report:DeviceDiagnosticReport)=>Promise<void>;arm:(marker:OfflineRestartMarker)=>Promise<void>;testModel:(report:DeviceDiagnosticReport,mode:DeviceModelTestMode)=>Promise<DeviceDiagnosticReport|null>};
function notRun(report:DeviceDiagnosticReport,failureType:string,testMode:DeviceModelTestMode){const model=report.selectedModel;if(model)report.modelGeneration={status:'not-run',testMode,model:model.id,modelRevision:model.revision,runtimeRevision:model.runtimeRevision,failureType};}
/** Performance runs here on every surface. Quick in an installed PWA defers
 * the model run to its claimed restart continuation; browser runs never arm it. */
export async function startDeviceTestSuite(ports:Ports,mode:DeviceTestMode='quick'){
 if(mode!=='app'&&mode!=='model-readiness'&&mode!=='quick'&&mode!=='performance'&&mode!=='full-cycle')throw Error('Unknown device test mode');
 let report=await ports.collect();report=structuredClone(report);report.deviceTestMode=mode;
 if(mode==='app'||mode==='model-readiness'){
  report.scope.push(mode==='model-readiness'?'Model readiness checks use the selected model metadata, local file-presence signal and browser runtime prerequisites. No model is loaded, verified by generation, prepared, or downloaded.':'App and storage checks only. No model is loaded, prepared, downloaded, or run. Cache presence does not prove offline cold launch.');
  report.manualSteps=[mode==='model-readiness'?'Review the selected model, file and runtime readiness signals.':'Review the app, storage and runtime check results.','Copy report for Codex to share the results.'];
  await ports.save(report);return {report,marker:null};
 }
 if(report.standalone&&mode==='quick'){
  notRun(report,report.selectedModel?.filesPresent?'restart-pending':'model-files-not-ready',mode);
  report.manualSteps=offlineRestartManualSteps(report.platform,report.userAgent,report.standalone);
  const marker:OfflineRestartMarker={schema:1,modelTestMode:mode,startedAt:new Date().toISOString(),appBuild:report.appBuild,modelTestRequested:!!report.selectedModel,...(report.selectedModel?{modelTestModel:report.selectedModel.id}:{}),baseline:{checkedAt:report.createdAt,appBuild:report.appBuild,standalone:report.standalone,onlineSignal:report.onlineSignal,checks:report.checks,...(report.modelGeneration?{modelGeneration:report.modelGeneration}:{})}};
  await ports.save(report);await ports.arm(marker);return {report,marker};
 }
 report.scope.push(mode==='performance'?'Performance mode does not schedule an offline restart.':'Restart testing requires the Home Screen app; this browser run does not arm a restart test in another storage context.');
 if(report.selectedModel&&(report.selectedModel.filesPresent||mode==='full-cycle')){report=await ports.testModel(report,mode)??report;if(!report.modelGeneration)notRun(report,'model-test-not-run',mode);}
 else notRun(report,'model-files-not-ready',mode);
 report.manualSteps=['Review the results in Developer.','Copy report for Codex to share the results.'];
 await ports.save(report);return {report,marker:null};
}
