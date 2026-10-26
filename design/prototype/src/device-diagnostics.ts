import type {DeviceTestMode} from './device-model-test.ts';
import {safeRuntimeLoadMetrics,type RuntimeLoadMetrics,type RuntimeGenerationMetrics} from './text-inference.ts';
export type DiagnosticCheck={id:string;status:'pass'|'fail'|'warning'|'not-run';detail:string};
export type ModelGenerationDiagnostic={status:'pass'|'fail'|'not-run'|'stopped'|'interrupted';testMode?:DeviceTestMode;quantization?:string;workload?:'ready-v1'|'prose-128-v1';inputTokens?:number;maxOutputTokens?:number;loadState?:'already-loaded'|'loaded-for-test';model:string;modelRevision:string;runtimeRevision:string;loadDurationMs?:number;loadMetrics?:RuntimeLoadMetrics;durationMs?:number;outputTokens?:number;tokensPerSecond?:number;answerCharacters?:number;failureType?:string;runtimeMetrics?:RuntimeGenerationMetrics};
export type SelectedModelDiagnostic={id:string;revision:string;engine?:string;backend?:'webgpu'|'cpu-wasm';runtimeRevision:string;filesPresent:boolean;loaded:boolean};
export const WEBGPU_DIAGNOSTIC_LIMIT_NAMES=['maxBufferSize','maxStorageBufferBindingSize','maxComputeWorkgroupStorageSize','maxComputeInvocationsPerWorkgroup','maxComputeWorkgroupSizeX','maxComputeWorkgroupSizeY','maxComputeWorkgroupSizeZ','maxComputeWorkgroupsPerDimension','minStorageBufferOffsetAlignment'] as const;
export type WebGpuDiagnostic={available:boolean;fallbackAdapter:boolean|null;features:string[];limits:Partial<Record<typeof WEBGPU_DIAGNOSTIC_LIMIT_NAMES[number],number>>};
export type WasmThreadDiagnostic={crossOriginIsolated:boolean;sharedArrayBuffer:boolean;sharedWasmMemory:boolean;prerequisitesReady:boolean};
export type DeviceDiagnosticReport={schema:1;createdAt:string;appBuild:string;bundle:string;platform:string;userAgent:string;standalone:boolean;connectionMode:'offline'|'online';onlineSignal:boolean;checks:DiagnosticCheck[];webgpu:WebGpuDiagnostic;wasmThreads:WasmThreadDiagnostic;manualSteps:string[];selectedModel?:SelectedModelDiagnostic;offlineRestart?:{startedAt:string;previousBuild:string;returnObserved:true;baseline:OfflineRestartMarker['baseline']};modelGeneration?:ModelGenerationDiagnostic;scope:string[]};
export type OfflineRestartMarker={schema:1;startedAt:string;appBuild:string;returnAttempted?:boolean;modelTestRequested?:boolean;modelTestModel?:string;modelTestMode?:DeviceTestMode;baseline:{checkedAt:string;appBuild:string;standalone:boolean;onlineSignal:boolean;checks:DiagnosticCheck[];modelGeneration?:ModelGenerationDiagnostic}};
export function canRunSelectedModelDiagnostic(input:{modelSelected:boolean;filesPresent:boolean;busy:boolean;otherModelLoaded:boolean}){return input.modelSelected&&input.filesPresent&&!input.busy&&!input.otherModelLoaded;}
/** A model smoke test passes only when the selected model returns the exact expected JSON shape and value. */
export function parseDeviceModelSmokeAnswer(text:string):'READY'{
 let value:unknown;
 try{value=JSON.parse(text);}catch{throw Error('Invalid structured response');}
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid structured response');
 const record=value as Record<string,unknown>;
 if(Object.keys(record).length!==1||!Object.hasOwn(record,'answer')||typeof record.answer!=='string'||record.answer.trim()!=='READY')throw Error('Invalid structured response');
 return 'READY';
}
/** iOS exposes Home Screen launch both through display-mode and its legacy Safari standalone flag. */
export function isStandalonePwa(displayModeStandalone:boolean,iosStandalone?:boolean){return displayModeStandalone||iosStandalone===true;}
export function wasmThreadCapability(input:{crossOriginIsolated?:boolean;sharedArrayBuffer?:boolean;sharedWasmMemory?:boolean}={}){
 const crossOriginIsolated=input.crossOriginIsolated??globalThis.crossOriginIsolated===true;
 const sharedArrayBuffer=input.sharedArrayBuffer??typeof SharedArrayBuffer!=='undefined';
 let sharedWasmMemory=input.sharedWasmMemory;
 if(sharedWasmMemory===undefined){try{const memory=new WebAssembly.Memory({initial:1,maximum:1,shared:true});sharedWasmMemory=typeof SharedArrayBuffer!=='undefined'&&memory.buffer instanceof SharedArrayBuffer;}catch{sharedWasmMemory=false;}}
 return {crossOriginIsolated,sharedArrayBuffer,sharedWasmMemory,prerequisitesReady:crossOriginIsolated&&sharedArrayBuffer&&sharedWasmMemory};
}
const offlineRestartKey='babelshelf.device-test.offline-restart.v1';
const savedReportKey='babelshelf.device-test.report.v1';
const offlineRestartTtlMs=24*60*60*1000;
const indexedDbNameCollision='Temporary IndexedDB name collision; existing database left untouched';
const emptyWebGpuDiagnostic=():WebGpuDiagnostic=>({available:false,fallbackAdapter:null,features:[],limits:{}});
const validWebGpuDiagnostic=(value:unknown):value is WebGpuDiagnostic=>{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const item=value as Record<string,unknown>,limits=item.limits;
 return typeof item.available==='boolean'&&(item.fallbackAdapter===null||typeof item.fallbackAdapter==='boolean')&&Array.isArray(item.features)&&item.features.length<=64&&item.features.every(feature=>typeof feature==='string'&&/^[a-z0-9-]{1,64}$/.test(feature))&&!!limits&&typeof limits==='object'&&!Array.isArray(limits)&&Object.keys(limits).every(key=>(WEBGPU_DIAGNOSTIC_LIMIT_NAMES as readonly string[]).includes(key)&&Number.isSafeInteger((limits as Record<string,unknown>)[key])&&Number((limits as Record<string,unknown>)[key])>0);
};
const validWasmThreadsDiagnostic=(value:unknown):value is WasmThreadDiagnostic=>!!value&&typeof value==='object'&&!Array.isArray(value)&&typeof (value as WasmThreadDiagnostic).crossOriginIsolated==='boolean'&&typeof (value as WasmThreadDiagnostic).sharedArrayBuffer==='boolean'&&typeof (value as WasmThreadDiagnostic).sharedWasmMemory==='boolean'&&typeof (value as WasmThreadDiagnostic).prerequisitesReady==='boolean'&&(value as WasmThreadDiagnostic).prerequisitesReady===((value as WasmThreadDiagnostic).crossOriginIsolated&&(value as WasmThreadDiagnostic).sharedArrayBuffer&&(value as WasmThreadDiagnostic).sharedWasmMemory);
const validRuntimeMetrics=(value:unknown):value is RuntimeGenerationMetrics=>{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const item=value as Record<string,unknown>,allowed=new Set(['countMs','visibleTextTtftMs','generationMs','outputTokens','generationTokensPerSecond','requestedThreads','runtimeThreads','runtimePromptTokens','runtimeCachedTokens','runtimePrefillMs','runtimeTtftMs','runtimeDecodeMs','runtimeDecodeTokensPerSecond','decodePipelineDepth','memoryBefore','memoryAfter']);
 for(const [key,entry]of Object.entries(item)){
  if(!allowed.has(key))return false;
  if(key==='memoryBefore'||key==='memoryAfter'){
   if(!entry||typeof entry!=='object'||Array.isArray(entry)||Object.keys(entry).length>16||Object.entries(entry).some(([name,n])=>!/^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(name)||typeof n!=='number'||!Number.isFinite(n)||n<0||n>Number.MAX_SAFE_INTEGER))return false;
  }else if(typeof entry!=='number'||!Number.isFinite(entry)||entry<0||entry>Number.MAX_SAFE_INTEGER)return false;
 }
 return true;
};
const validLoadMetrics=(value:unknown)=>{const safe=safeRuntimeLoadMetrics(value);return !!safe&&Object.keys(safe).length===Object.keys(value as object).length;};
const validModelGeneration=(value:unknown):value is ModelGenerationDiagnostic=>{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const item=value as Record<string,unknown>;
 return (item.quantization===undefined||typeof item.quantization==='string'&&item.quantization.length<=100)&&(item.testMode===undefined||item.testMode==='quick'||item.testMode==='performance')&&(item.workload===undefined||['ready-v1','prose-128-v1'].includes(String(item.workload)))&&(item.loadState===undefined||['already-loaded','loaded-for-test'].includes(String(item.loadState)))&&['inputTokens','maxOutputTokens'].every(key=>item[key]===undefined||Number.isSafeInteger(item[key])&&Number(item[key])>=0&&Number(item[key])<=1000000)&&['pass','fail','not-run','stopped','interrupted'].includes(String(item.status))&&typeof item.model==='string'&&item.model.length>0&&item.model.length<=120&&typeof item.modelRevision==='string'&&item.modelRevision.length>0&&item.modelRevision.length<=120&&typeof item.runtimeRevision==='string'&&item.runtimeRevision.length>0&&item.runtimeRevision.length<=120&&(['loadDurationMs','durationMs','outputTokens','tokensPerSecond','answerCharacters'].every(key=>item[key]===undefined||typeof item[key]==='number'&&Number.isFinite(item[key])&&item[key]>=0&&item[key]<=Number.MAX_SAFE_INTEGER))&&(item.failureType===undefined||typeof item.failureType==='string'&&item.failureType.length<=80)&&(item.loadMetrics===undefined||validLoadMetrics(item.loadMetrics))&&(item.runtimeMetrics===undefined||validRuntimeMetrics(item.runtimeMetrics));
};
const probeId=()=>{
 const cryptoApi=globalThis.crypto;
 if(cryptoApi?.randomUUID)return cryptoApi.randomUUID();
 if(cryptoApi?.getRandomValues){const bytes=cryptoApi.getRandomValues(new Uint8Array(16));return Array.from(bytes,value=>value.toString(16).padStart(2,'0')).join('');}
 throw Error('Secure random identifiers unavailable');
};

export function readOfflineRestartMarker(storage:Pick<Storage,'getItem'|'removeItem'>,now=Date.now()):OfflineRestartMarker|null{
 let raw:string|null;try{raw=storage.getItem(offlineRestartKey);}catch{return null;}if(raw===null)return null;
 try{const value=JSON.parse(raw),generation=value?.baseline?.modelGeneration,started=Date.parse(value?.startedAt);if((value?.modelTestMode===undefined||['quick','performance'].includes(value.modelTestMode))&&value?.schema===1&&typeof value.startedAt==='string'&&Number.isFinite(started)&&now>=started&&now-started<=offlineRestartTtlMs&&typeof value.appBuild==='string'&&value.appBuild.length<=40&&(value.returnAttempted===undefined||typeof value.returnAttempted==='boolean')&&(!('modelTestRequested' in value)||typeof value.modelTestRequested==='boolean'&&(value.modelTestRequested===false||typeof value.modelTestModel==='string'&&value.modelTestModel.length>0&&value.modelTestModel.length<=120))&&value.baseline&&Number.isFinite(Date.parse(value.baseline.checkedAt))&&typeof value.baseline.appBuild==='string'&&value.baseline.appBuild.length<=40&&typeof value.baseline.standalone==='boolean'&&typeof value.baseline.onlineSignal==='boolean'&&Array.isArray(value.baseline.checks)&&value.baseline.checks.length<=20&&value.baseline.checks.every((check:DiagnosticCheck)=>typeof check?.id==='string'&&check.id.length<=60&&['pass','fail','warning','not-run'].includes(check.status)&&typeof check.detail==='string'&&check.detail.length<=180)&&(!generation||validModelGeneration(generation)))return value;}catch{}
 try{storage.removeItem(offlineRestartKey);}catch{}return null;
}
export function writeOfflineRestartMarker(storage:Pick<Storage,'setItem'>,marker:OfflineRestartMarker){
 if((marker.modelTestMode!==undefined&&!['quick','performance'].includes(marker.modelTestMode))||marker.schema!==1||!Number.isFinite(Date.parse(marker.startedAt))||typeof marker.appBuild!=='string'||marker.appBuild.length>40||(marker.returnAttempted!==undefined&&typeof marker.returnAttempted!=='boolean')||(marker.modelTestRequested!==undefined&&typeof marker.modelTestRequested!=='boolean')||(marker.modelTestRequested===true&&(typeof marker.modelTestModel!=='string'||!marker.modelTestModel.length||marker.modelTestModel.length>120))||!Number.isFinite(Date.parse(marker.baseline?.checkedAt))||typeof marker.baseline?.appBuild!=='string'||marker.baseline.appBuild.length>40||marker.baseline.checks.length>20||marker.baseline.checks.some(check=>check.id.length>60||check.detail.length>180||!['pass','fail','warning','not-run'].includes(check.status)))throw Error('Invalid offline test marker');
 storage.setItem(offlineRestartKey,JSON.stringify(marker));
}
export function clearOfflineRestartMarker(storage:Pick<Storage,'removeItem'>){storage.removeItem(offlineRestartKey);}
/** Persist the one allowed post-restart attempt before any potentially failing probe starts. */
export function claimOfflineRestartAttempt(storage:Pick<Storage,'getItem'|'setItem'|'removeItem'>,marker:OfflineRestartMarker,now=Date.now()):boolean{
 const current=readOfflineRestartMarker(storage,now);
 if(!current||current.startedAt!==marker.startedAt||current.returnAttempted)return false;
 writeOfflineRestartMarker(storage,{...current,returnAttempted:true});return true;
}

function validSelectedModelDiagnostic(value:unknown):value is SelectedModelDiagnostic{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const item=value as Record<string,unknown>;
 return typeof item.id==='string'&&item.id.length>0&&item.id.length<=120&&typeof item.revision==='string'&&item.revision.length>0&&item.revision.length<=120&&(item.engine===undefined||typeof item.engine==='string'&&/^[a-z0-9][a-z0-9._-]{0,79}$/.test(item.engine))&&(item.backend===undefined||item.backend==='webgpu'||item.backend==='cpu-wasm')&&typeof item.runtimeRevision==='string'&&item.runtimeRevision.length>0&&item.runtimeRevision.length<=120&&typeof item.filesPresent==='boolean'&&typeof item.loaded==='boolean';
}

export function readSavedDeviceTestReport(storage:Pick<Storage,'getItem'>):string{
 try{const report=storage.getItem(savedReportKey)??'';if(report.length>40000)return'';const value=JSON.parse(report);return value?.schema===1&&typeof value.createdAt==='string'&&Array.isArray(value.checks)&&value.checks.length<=30&&(!('webgpu' in value)||validWebGpuDiagnostic(value.webgpu))&&(!('wasmThreads' in value)||validWasmThreadsDiagnostic(value.wasmThreads))&&(!('selectedModel' in value)||validSelectedModelDiagnostic(value.selectedModel))&&(!('modelGeneration' in value)||validModelGeneration(value.modelGeneration))?report:'';}catch{return'';}
}
export function writeSavedDeviceTestReport(storage:Pick<Storage,'setItem'>,report:string){if(report.length>40000)throw Error('Device test report is too large');const value=JSON.parse(report);if(value?.schema!==1||typeof value.createdAt!=='string'||!Array.isArray(value.checks)||value.checks.length>30||('webgpu' in value&&!validWebGpuDiagnostic(value.webgpu))||('wasmThreads' in value&&!validWasmThreadsDiagnostic(value.wasmThreads))||('selectedModel' in value&&!validSelectedModelDiagnostic(value.selectedModel))||('modelGeneration' in value&&!validModelGeneration(value.modelGeneration)))throw Error('Invalid device test report');storage.setItem(savedReportKey,report);}
export function clearSavedDeviceTestReport(storage:Pick<Storage,'removeItem'>){storage.removeItem(savedReportKey);}

/** Adds measured return signals without claiming the browser can prove iOS force-close or Airplane Mode. */
export function completeOfflineRestartReport(report:DeviceDiagnosticReport,marker:OfflineRestartMarker):DeviceDiagnosticReport{
 const controlled=report.checks.find(check=>check.id==='service-worker')?.status==='pass',offline=!report.onlineSignal,success=controlled&&offline&&report.standalone;
 return {...report,checks:[...report.checks,{id:'offline-cold-reopen',status:success?'pass':'warning',detail:success?'App returned with its local marker under a service worker while the browser reports offline and standalone mode. iOS Airplane Mode and force-close are not independently verifiable.':'Return was observed, but standalone mode, service-worker control, or offline browser signal was missing. iOS Airplane Mode and force-close are not independently verifiable.'},{id:'ios-system-state',status:'warning',detail:'The browser cannot verify iOS Airplane Mode, force-close, device model, or OS version.'}],offlineRestart:{startedAt:marker.startedAt,previousBuild:marker.appBuild,returnObserved:true,baseline:marker.baseline},...(marker.baseline.modelGeneration?{modelGeneration:marker.baseline.modelGeneration}:{}),scope:[...report.scope,'The app observed a return with a persisted test marker. The browser cannot prove that iOS force-closed the app or that Airplane Mode was enabled.'],manualSteps:[]};
}

/** Records an interrupted one-run attempt without automatically executing the probes again. */
export function completeInterruptedOfflineRestartReport(report:DeviceDiagnosticReport,marker:OfflineRestartMarker):DeviceDiagnosticReport{
 const detail='The single post-restart diagnostic attempt was interrupted. It was not run again automatically; iOS Airplane Mode and force-close remain unverifiable.';
 const checks=report.checks.filter(check=>check.id!=='offline-cold-reopen'&&check.id!=='ios-system-state');
 const selectedModel=report.selectedModel?.id===marker.modelTestModel?report.selectedModel:undefined;
 const modelGeneration=marker.modelTestRequested?{status:'interrupted' as const,model:marker.modelTestModel??report.selectedModel?.id??'unknown',modelRevision:selectedModel?.revision??'unknown',runtimeRevision:selectedModel?.runtimeRevision??'unknown',failureType:'return-attempt-interrupted'}:undefined;
 return {...report,createdAt:new Date().toISOString(),checks:[...checks,{id:'offline-cold-reopen',status:'warning',detail},{id:'ios-system-state',status:'warning',detail:'The browser cannot verify iOS Airplane Mode, force-close, device model, or OS version.'}],offlineRestart:{startedAt:marker.startedAt,previousBuild:marker.appBuild,returnObserved:true,baseline:marker.baseline},...(modelGeneration?{modelGeneration}:{}),manualSteps:[],scope:[...report.scope,'The return diagnostic was interrupted after its one allowed attempt; it was not automatically repeated. The report preserves the baseline and does not claim the offline restart passed.',...(modelGeneration?['The requested model smoke has no completed result because its single post-restart attempt was interrupted; it will not be retried automatically.']:[])]};
}

type DiagnosticEnvironment={
 now?:()=>Date;
 isSecureContext?:boolean;
 platform?:string;
 userAgent?:string;
 standalone?:boolean;
 online?:boolean;
 serviceWorker?:Pick<ServiceWorkerContainer,'controller'>|null;
 appBuild?:string;
 cacheStorage?:Pick<CacheStorage,'keys'>|null;
 storage?:Pick<Storage,'setItem'|'getItem'|'removeItem'>|null;
 indexedDB?:Pick<IDBFactory,'open'|'deleteDatabase'>|null;
 opfs?:{getDirectory:()=>Promise<Pick<FileSystemDirectoryHandle,'getFileHandle'|'removeEntry'>>}|null;
 gpu?:{requestAdapter:()=>Promise<unknown>}|null;
 crossOriginIsolated?:boolean;
 sharedArrayBuffer?:boolean;
 sharedWasmMemory?:boolean;
 applicationSmoke?:()=>Promise<void>;
 inferenceLocks?:boolean;
 selectedModel?:string;
 selectedModelRevision?:string;
 selectedModelEngine?:string;
 selectedModelBackend?:'webgpu'|'cpu-wasm';
 runtimeRevision?:string;
 modelFilesPresent?:boolean;
 modelLoaded?:boolean;
 connectionMode?:'offline'|'online';
 bundle?:string;
};

async function indexedDbProbe(factory:Pick<IDBFactory,'open'|'deleteDatabase'>,name:string):Promise<boolean>{
 let db:IDBDatabase|undefined;let created=false;let testError:unknown;
 try{await new Promise<void>((resolve,reject)=>{const request=factory.open(name,1);request.onupgradeneeded=()=>{created=true;request.result.createObjectStore('probe');};request.onerror=()=>reject(request.error??Error('IndexedDB open failed'));request.onsuccess=()=>{db=request.result;if(!created){reject(Error(indexedDbNameCollision));return;}try{const tx=db.transaction('probe','readwrite'),store=tx.objectStore('probe'),value='local-test';store.put(value,'roundtrip');const read=store.get('roundtrip');read.onsuccess=()=>{if(read.result!==value)tx.abort();};tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error??Error('IndexedDB transaction failed'));tx.onabort=()=>reject(tx.error??Error('IndexedDB transaction aborted'));}catch(error){reject(error);}};});}
 catch(error){testError=error;}
 finally{db?.close();}
 if(created){try{await new Promise<void>((resolve,reject)=>{const request=factory.deleteDatabase(name);request.onsuccess=()=>resolve();request.onerror=()=>reject(request.error??Error('IndexedDB cleanup failed'));request.onblocked=()=>reject(Error('IndexedDB cleanup blocked'));});}
 catch(error){throw Error(`Temporary IndexedDB cleanup failed: ${error instanceof Error?error.message:'blocked'}`);}}
 if(testError)throw testError;
 return true;
}

async function opfsProbe(storage:{getDirectory:()=>Promise<Pick<FileSystemDirectoryHandle,'getFileHandle'|'removeEntry'>>},name:string):Promise<void>{
 const root=await storage.getDirectory();let created=false,writer:FileSystemWritableFileStream|undefined,testError:unknown;
 try{
  let collision=false;
  try{await root.getFileHandle(name);collision=true;}catch(error){if((error as DOMException)?.name!=='NotFoundError')throw error;}
  if(collision)throw Error('Temporary OPFS name collision; existing file left untouched');
  const handle=await root.getFileHandle(name,{create:true});created=true;writer=await handle.createWritable();const expected=new TextEncoder().encode('babelshelf-opfs-probe-v1');
  await writer.write(expected);await writer.close();writer=undefined;
  const actual=new Uint8Array(await(await handle.getFile()).arrayBuffer());
  if(actual.length!==expected.length||actual.some((value,index)=>value!==expected[index]))throw Error('Temporary OPFS roundtrip failed');
 }catch(error){testError=error;}
 finally{
  if(writer)await writer.abort().catch(()=>{});
  if(created)try{await root.removeEntry(name);}catch(error){throw Error(`Temporary OPFS cleanup failed: ${error instanceof Error?error.message:'blocked'}`);}
 }
 if(testError)throw testError;
}

async function inspectWebGpuAdapter(gpu:NonNullable<DiagnosticEnvironment['gpu']>):Promise<WebGpuDiagnostic>{
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{
  const adapter=await Promise.race([gpu.requestAdapter(),new Promise<null>(resolve=>{timer=setTimeout(()=>resolve(null),8000);})]) as {features?:Iterable<unknown>;limits?:Record<string,unknown>;isFallbackAdapter?:unknown}|null;
  if(!adapter)return emptyWebGpuDiagnostic();
  const features=[...new Set(Array.from(adapter.features??[]).filter((feature):feature is string=>typeof feature==='string'&&/^[a-z0-9-]{1,64}$/.test(feature)))].sort().slice(0,64),limits:WebGpuDiagnostic['limits']={};
  for(const name of WEBGPU_DIAGNOSTIC_LIMIT_NAMES){const value=adapter.limits?.[name];if(typeof value==='number'&&Number.isSafeInteger(value)&&value>0)limits[name]=value;}
  return {available:true,fallbackAdapter:typeof adapter.isFallbackAdapter==='boolean'?adapter.isFallbackAdapter:null,features,limits};
 }catch{return emptyWebGpuDiagnostic();}finally{if(timer)clearTimeout(timer);}
}

/** Runs bounded, local-only environment checks. Model generation is handled separately by the UI flow. */
export async function runDeviceDiagnostics(env:DiagnosticEnvironment={}):Promise<DeviceDiagnosticReport>{
 const now=env.now??(()=>new Date()),checks:DiagnosticCheck[]=[];
 const add=(id:string,status:DiagnosticCheck['status'],detail:string)=>checks.push({id,status,detail:detail.slice(0,180)});
 const standalone=env.standalone??(typeof matchMedia==='function'&&matchMedia('(display-mode: standalone)').matches);
 const secure=env.isSecureContext??globalThis.isSecureContext;
 add('secure-context',secure?'pass':'fail',secure?'Secure context available':'Secure context required for PWA capabilities');
 const controller=env.serviceWorker===undefined?(typeof navigator!=='undefined'?navigator.serviceWorker:undefined):env.serviceWorker;
 add('service-worker',controller?.controller?'pass':'fail',controller?.controller?'This page is controlled by a service worker':'No active service worker controls this page');
 add('app-build',env.appBuild&&env.appBuild!=='Unknown'&&env.appBuild!=='Unavailable'?'pass':'warning',env.appBuild??'Build identity unavailable');
 add('home-screen-launch',standalone?'pass':'warning',standalone?'Installed standalone display mode detected':'Opened in a browser tab; open the Home Screen app before starting the one-run cold-restart check');

 const cache=env.cacheStorage===undefined?(typeof caches!=='undefined'?caches:undefined):env.cacheStorage;
 try{const keys=cache?await cache.keys():[];add('offline-cache',keys.length?'pass':'warning',keys.length?`${keys.length} cache bucket(s) present; offline restart not proven`:'No app cache bucket detected');}
 catch{add('offline-cache','warning','Cache storage could not be inspected');}

 const storage=env.storage===undefined?(typeof localStorage!=='undefined'?localStorage:undefined):env.storage;
 if(!storage)add('storage-roundtrip','fail','Local storage unavailable');
 else {let key='';try{key=`babelshelf.diagnostic-probe.${probeId()}`;storage.setItem(key,'ok');const passed=storage.getItem(key)==='ok';storage.removeItem(key);add('storage-roundtrip',passed?'pass':'fail',passed?'Temporary local write/read/remove passed':'Temporary local roundtrip failed');}catch{if(key)try{storage.removeItem(key);}catch{}add('storage-roundtrip','fail','Temporary local storage probe failed');}}

 const idb=env.indexedDB===undefined?(typeof indexedDB!=='undefined'?indexedDB:undefined):env.indexedDB;
 if(!idb)add('indexeddb-roundtrip','fail','IndexedDB unavailable');
 else {try{const name=`babelshelf-diagnostic-${probeId()}`;await indexedDbProbe(idb,name);add('indexeddb-roundtrip','pass','Temporary isolated database write/read/delete passed');}catch(error){add('indexeddb-roundtrip','fail',error instanceof Error&&error.message===indexedDbNameCollision?indexedDbNameCollision:'Temporary IndexedDB probe failed');}}
 if(!idb)add('memory-store-smoke','not-run','IndexedDB unavailable');
 else if(!env.applicationSmoke)add('memory-store-smoke','not-run','Isolated Memory workflow was not supplied');
 else {try{await env.applicationSmoke();add('memory-store-smoke','pass','Isolated production Memory workflow passed · temporary database deleted');}catch(error){const stage=(error as {stage?:unknown})?.stage,details:Record<string,string>={setup:'Temporary Memory database setup failed',initialize:'Temporary Memory initialization failed',write:'Memory create check failed',read:'Memory read check failed',search:'Memory search check failed',revise:'Memory correction-history check failed',backup:'Memory backup validation failed',withdraw:'Memory withdrawal check failed',cleanup:'Temporary Memory cleanup failed'},detail=typeof stage==='string'&&Object.hasOwn(details,stage)?details[stage]:'Isolated production Memory workflow failed · reason unavailable';add('memory-store-smoke','fail',detail);}}

 const opfs=env.opfs===undefined?(typeof navigator!=='undefined'&&typeof navigator.storage?.getDirectory==='function'?navigator.storage:undefined):env.opfs;
 if(!opfs)add('opfs-roundtrip','not-run','Origin Private File System unavailable; OPFS model assets cannot be checked');
 else {try{await opfsProbe(opfs,`babelshelf-diagnostic-${probeId()}`);add('opfs-roundtrip','pass','Temporary OPFS file write/read/delete passed');}catch{add('opfs-roundtrip','fail','Temporary OPFS file check failed · existing files were not intentionally modified');}}

 const inferenceLocks=env.inferenceLocks??(typeof navigator!=='undefined'&&!!navigator.locks);
 add('cross-tab-inference',inferenceLocks?'pass':'warning',inferenceLocks?'Web Locks API available for origin-wide model coordination':'Web Locks API unavailable · simultaneous BabelShelf tabs may compete for device memory');

 const wasmThreads=wasmThreadCapability({crossOriginIsolated:env.crossOriginIsolated,sharedArrayBuffer:env.sharedArrayBuffer,sharedWasmMemory:env.sharedWasmMemory});
 add('wasm-threads',wasmThreads.prerequisitesReady?'pass':'warning',wasmThreads.prerequisitesReady?'Cross-origin isolation and shared WebAssembly memory available; runtime thread-pool use is not verified':'Shared WebAssembly threading prerequisites unavailable; CPU engines should use their single-thread fallback');
 const gpu=env.gpu===undefined?(globalThis.navigator as Navigator&{gpu?:NonNullable<DiagnosticEnvironment['gpu']>}|undefined)?.gpu:env.gpu;
 let webgpu=emptyWebGpuDiagnostic();
 if(!gpu)add('webgpu','not-run','WebGPU API unavailable; CPU/WASM may still be supported');
 else {webgpu=await inspectWebGpuAdapter(gpu);add('webgpu',webgpu.available?'pass':'warning',webgpu.available?'Adapter available; limits recorded; model execution and memory fit not tested':'Adapter unavailable or timed out');}
 if(!env.selectedModel)add('selected-model','not-run','No text model selected');
 else if(!env.modelFilesPresent)add('selected-model','warning',`${env.selectedModel}: model files not verified`);
 else add('selected-model',env.modelLoaded?'pass':'warning',`${env.selectedModel}: files verified${env.modelLoaded?' and model loaded':' ; generation not tested'}`);

 const platform=(env.platform??(typeof navigator!=='undefined'?navigator.platform:'Unknown')).slice(0,80);
 const userAgent=(env.userAgent??(typeof navigator!=='undefined'?navigator.userAgent:'Unknown')).slice(0,240);
 const engine=env.selectedModelEngine&&/^[a-z0-9][a-z0-9._-]{0,79}$/.test(env.selectedModelEngine)?env.selectedModelEngine:undefined,backend=env.selectedModelBackend==='webgpu'||env.selectedModelBackend==='cpu-wasm'?env.selectedModelBackend:undefined;
 const selectedModel=env.selectedModel?{id:env.selectedModel.slice(0,120),revision:(env.selectedModelRevision??'unknown').slice(0,120),...(engine?{engine}:{}),...(backend?{backend}:{}),runtimeRevision:(env.runtimeRevision??'unknown').slice(0,120),filesPresent:env.modelFilesPresent??false,loaded:env.modelLoaded??false}:undefined;
 const manualSteps=standalone?['Select Run tests in Settings > Developer.','Switch iPhone to Airplane Mode, force-close BabelShelf, and reopen it from the Home Screen.','The return check runs automatically. Open Settings > Developer and copy the saved report.']:['Open BabelShelf from its Home Screen icon before starting the one-run cold-restart check. Browser-tab and installed-PWA storage can differ.','In the Home Screen app, open Settings > Developer and select Run tests.','Switch iPhone to Airplane Mode, force-close BabelShelf, and reopen it from the Home Screen. The return check runs automatically.'];
 return {schema:1,createdAt:now().toISOString(),appBuild:(env.appBuild??'Unknown').slice(0,40),bundle:(env.bundle??'Unknown').slice(0,100),platform,userAgent,standalone,connectionMode:env.connectionMode??'offline',onlineSignal:env.online??(typeof navigator!=='undefined'&&navigator.onLine),checks,webgpu,wasmThreads,manualSteps,...(selectedModel?{selectedModel}:{}),scope:['Checks run in this PWA on this device.','Selected engine/backend identify the registered execution route; they do not prove which hardware adapter executed the model.','WebGPU data contains only bounded feature names and selected numeric limits; adapter vendor is omitted and limits do not prove model fit.','WASM thread readiness records browser prerequisites only and does not prove a selected engine used a worker pool.','Online status is only a browser signal; cached assets do not prove a successful offline cold launch.','This run does not inspect knowledge files, prompts, model output, or send data.','Model readiness is not a generation, quality, thermal, or sustained-performance test.']};
}

export function formatDeviceDiagnosticReport(report:DeviceDiagnosticReport):string{return JSON.stringify(report,null,2);}
