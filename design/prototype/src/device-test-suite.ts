import type {DeviceTestMode} from './device-model-test.ts';
import type {DeviceDiagnosticReport,OfflineRestartMarker} from './device-diagnostics.ts';
type Ports={collect:()=>Promise<DeviceDiagnosticReport>;save:(report:DeviceDiagnosticReport)=>Promise<void>;arm:(marker:OfflineRestartMarker)=>Promise<void>;testModel:(report:DeviceDiagnosticReport,mode:DeviceTestMode)=>Promise<DeviceDiagnosticReport|null>};
function notRun(report:DeviceDiagnosticReport,failureType:string){const model=report.selectedModel;if(model)report.modelGeneration={status:'not-run',model:model.id,modelRevision:model.revision,runtimeRevision:model.runtimeRevision,failureType};}
/** One explicit start. Installed PWAs defer the single model run until the claimed
 * restart continuation; browser tabs finish locally and never arm another store. */
export async function startDeviceTestSuite(ports:Ports,mode:DeviceTestMode='quick'){
 if(mode!=='quick'&&mode!=='performance')throw Error('Unknown device test mode');
 let report=await ports.collect();report=structuredClone(report);
 if(report.standalone){
  notRun(report,report.selectedModel?.filesPresent?'restart-pending':'model-files-not-ready');
  report.manualSteps=['Turn on Airplane Mode. Close BabelShelf.','Open BabelShelf from the Home Screen. Tests continue automatically.','Open Developer and copy the report.'];
  const marker:OfflineRestartMarker={schema:1,modelTestMode:mode,startedAt:new Date().toISOString(),appBuild:report.appBuild,modelTestRequested:!!report.selectedModel,...(report.selectedModel?{modelTestModel:report.selectedModel.id}:{}),baseline:{checkedAt:report.createdAt,appBuild:report.appBuild,standalone:report.standalone,onlineSignal:report.onlineSignal,checks:report.checks,...(report.modelGeneration?{modelGeneration:report.modelGeneration}:{})}};
  await ports.save(report);await ports.arm(marker);return {report,marker};
 }
 report.scope.push('Restart testing requires the Home Screen app; this browser run does not arm a restart test in another storage context.');
 if(report.selectedModel?.filesPresent){report=await ports.testModel(report,mode)??report;if(!report.modelGeneration)notRun(report,'model-test-not-run');}
 else notRun(report,'model-files-not-ready');
 await ports.save(report);return {report,marker:null};
}
