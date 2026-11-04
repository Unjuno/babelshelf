import type {DeviceModelTestMode,DeviceTestMode} from './device-model-test.ts';
import {offlineRestartManualSteps,type DeviceDiagnosticReport,type OfflineRestartMarker} from './device-diagnostics.ts';
type Ports={collect:()=>Promise<DeviceDiagnosticReport>;save:(report:DeviceDiagnosticReport)=>Promise<void>;arm:(marker:OfflineRestartMarker)=>Promise<void>;testModel:(report:DeviceDiagnosticReport,mode:DeviceModelTestMode)=>Promise<DeviceDiagnosticReport|null>};
function notRun(report:DeviceDiagnosticReport,failureType:string,testMode:DeviceModelTestMode){const model=report.selectedModel;if(model)report.modelGeneration={status:'not-run',testMode,model:model.id,modelRevision:model.revision,runtimeRevision:model.runtimeRevision,failureType};}
/** Performance runs here on every surface. Quick in an installed PWA defers
 * the model run to its claimed restart continuation; browser runs never arm it. */
export async function startDeviceTestSuite(ports:Ports,mode:DeviceTestMode='quick'){
 if(!['app','offline-readiness','storage-health','runtime-support','model-readiness','quick','performance','full-cycle'].includes(mode))throw Error('Unknown device test mode');
 let report=await ports.collect();report=structuredClone(report);report.deviceTestMode=mode;
 if(['app','offline-readiness','storage-health','runtime-support','model-readiness'].includes(mode)){
  const descriptions:Record<string,{scope:string;review:string}>={
   app:{scope:'App and storage checks only. No model is loaded, prepared, downloaded, or run. Cache presence does not prove offline cold launch.',review:'Review the app, storage and runtime check results.'},
   'offline-readiness':{scope:'Offline readiness checks report secure access, service worker, build cache and install signals. They do not simulate a cold offline restart or verify OS network state.',review:'Review the service worker, current build cache and install signals. Use the restart check to verify a cold offline launch.'},
   'storage-health':{scope:'Storage health checks use temporary isolated probes and remove their test data. Existing Memory files are not read or changed; model is not loaded or downloaded.',review:'Review local storage, IndexedDB, OPFS, cache and temporary Memory workflow results.'},
   'runtime-support':{scope:'Runtime support checks report browser capabilities and configured model readiness. They do not prove that a model uses WebGPU, fits memory, or can generate.',review:'Review WebGPU, WebAssembly, model coordination and selected-model file signals.'},
   'model-readiness':{scope:'Model readiness checks use the selected model metadata, local file-presence signal and browser runtime prerequisites. No model is loaded, verified by generation, prepared, or downloaded.',review:'Review the selected model, file and runtime readiness signals.'}
  };
  const description=descriptions[mode];report.scope.push(description.scope);
  report.manualSteps=[description.review,'Copy report for Codex to share the results.'];
  await ports.save(report);return {report,marker:null};
 }
 const modelMode:DeviceModelTestMode|undefined=mode==='quick'||mode==='performance'||mode==='full-cycle'?mode:undefined;
 if(!modelMode)throw Error('Unknown device test mode');
 if(report.standalone&&modelMode==='quick'){
  notRun(report,report.selectedModel?.filesPresent?'restart-pending':'model-files-not-ready',modelMode);
  report.manualSteps=offlineRestartManualSteps(report.platform,report.userAgent,report.standalone);
  const marker:OfflineRestartMarker={schema:1,modelTestMode:modelMode,startedAt:new Date().toISOString(),appBuild:report.appBuild,modelTestRequested:!!report.selectedModel,...(report.selectedModel?{modelTestModel:report.selectedModel.id}:{}),baseline:{checkedAt:report.createdAt,appBuild:report.appBuild,standalone:report.standalone,onlineSignal:report.onlineSignal,checks:report.checks,...(report.modelGeneration?{modelGeneration:report.modelGeneration}:{})}};
  await ports.save(report);await ports.arm(marker);return {report,marker};
 }
 report.scope.push(modelMode==='performance'?'Performance mode does not schedule an offline restart.':'Restart testing requires the Home Screen app; this browser run does not arm a restart test in another storage context.');
 if(report.selectedModel&&(report.selectedModel.filesPresent||modelMode==='full-cycle')){
  // Persist a copyable baseline before any model/runtime wait. If loading is
  // slow or the page is suspended, the user can still share device evidence.
  notRun(report,'model-test-in-progress',modelMode);
  report.scope.push('Environment snapshot saved before the model test. While the test runs, this report can be copied without waiting for model load or generation.');
  report.manualSteps=['Model test may still be running. Copy the current report at any time.','Stop the model test to record its completed or stopped stage.'];
  await ports.save(report);
  report=await ports.testModel(report,modelMode)??report;if(!report.modelGeneration||report.modelGeneration.failureType==='model-test-in-progress')notRun(report,'model-test-not-run',modelMode);
 }
 else notRun(report,'model-files-not-ready',modelMode);
 report.manualSteps=['Review the results in Developer.','Copy report for Codex to share the results.'];
 await ports.save(report);return {report,marker:null};
}
