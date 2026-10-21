export type DiagnosticCheck={id:string;status:'pass'|'fail'|'warning'|'not-run';detail:string};
export type ModelGenerationDiagnostic={status:'pass'|'fail'|'not-run'|'stopped';model:string;modelRevision:string;runtimeRevision:string;loadDurationMs?:number;durationMs?:number;outputTokens?:number;tokensPerSecond?:number;answerCharacters?:number;failureType?:string};
export type DeviceDiagnosticReport={schema:1;createdAt:string;appBuild:string;bundle:string;platform:string;userAgent:string;standalone:boolean;connectionMode:'offline'|'online';onlineSignal:boolean;checks:DiagnosticCheck[];manualSteps:string[];offlineRestart?:{startedAt:string;previousBuild:string;userConfirmedResume:true;baseline:OfflineRestartMarker['baseline']};modelGeneration?:ModelGenerationDiagnostic;scope:string[]};
export type OfflineRestartMarker={schema:1;startedAt:string;appBuild:string;baseline:{checkedAt:string;appBuild:string;standalone:boolean;onlineSignal:boolean;checks:DiagnosticCheck[];modelGeneration?:ModelGenerationDiagnostic}};
const offlineRestartKey='babelshelf.device-test.offline-restart.v1';
const probeId=()=>globalThis.crypto?.randomUUID?.()??`${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function readOfflineRestartMarker(storage:Pick<Storage,'getItem'>):OfflineRestartMarker|null{
 try{const value=JSON.parse(storage.getItem(offlineRestartKey)??'null'),generation=value?.baseline?.modelGeneration;if(value?.schema===1&&typeof value.startedAt==='string'&&Number.isFinite(Date.parse(value.startedAt))&&typeof value.appBuild==='string'&&value.appBuild.length<=40&&value.baseline&&Number.isFinite(Date.parse(value.baseline.checkedAt))&&typeof value.baseline.appBuild==='string'&&value.baseline.appBuild.length<=40&&typeof value.baseline.standalone==='boolean'&&typeof value.baseline.onlineSignal==='boolean'&&Array.isArray(value.baseline.checks)&&value.baseline.checks.length<=20&&value.baseline.checks.every((check:DiagnosticCheck)=>typeof check?.id==='string'&&check.id.length<=60&&['pass','fail','warning','not-run'].includes(check.status)&&typeof check.detail==='string'&&check.detail.length<=180)&&(!generation||(['pass','fail','not-run','stopped'].includes(generation.status)&&typeof generation.model==='string'&&generation.model.length<=120&&typeof generation.modelRevision==='string'&&generation.modelRevision.length<=120&&typeof generation.runtimeRevision==='string'&&generation.runtimeRevision.length<=120&&(!generation.loadDurationMs||Number.isFinite(generation.loadDurationMs))&&(!generation.durationMs||Number.isFinite(generation.durationMs))&&(!generation.outputTokens||Number.isSafeInteger(generation.outputTokens))&&(!generation.tokensPerSecond||Number.isFinite(generation.tokensPerSecond))&&(!generation.answerCharacters||Number.isSafeInteger(generation.answerCharacters))&&(!generation.failureType||typeof generation.failureType==='string'&&generation.failureType.length<=80))))return value;}catch{}return null;
}
export function writeOfflineRestartMarker(storage:Pick<Storage,'setItem'>,marker:OfflineRestartMarker){
 if(marker.schema!==1||!Number.isFinite(Date.parse(marker.startedAt))||typeof marker.appBuild!=='string'||marker.appBuild.length>40||!Number.isFinite(Date.parse(marker.baseline?.checkedAt))||typeof marker.baseline?.appBuild!=='string'||marker.baseline.appBuild.length>40||marker.baseline.checks.length>20||marker.baseline.checks.some(check=>check.id.length>60||check.detail.length>180||!['pass','fail','warning','not-run'].includes(check.status)))throw Error('Invalid offline test marker');
 storage.setItem(offlineRestartKey,JSON.stringify(marker));
}
export function clearOfflineRestartMarker(storage:Pick<Storage,'removeItem'>){storage.removeItem(offlineRestartKey);}

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
 gpu?:{requestAdapter:()=>Promise<unknown>}|null;
 selectedModel?:string;
 modelFilesPresent?:boolean;
 modelLoaded?:boolean;
 connectionMode?:'offline'|'online';
 bundle?:string;
};

async function indexedDbProbe(factory:Pick<IDBFactory,'open'|'deleteDatabase'>,name:string):Promise<boolean>{
 let db:IDBDatabase|undefined;let testError:unknown;
 try{await new Promise<void>((resolve,reject)=>{const request=factory.open(name,1);request.onupgradeneeded=()=>request.result.createObjectStore('probe');request.onerror=()=>reject(request.error??Error('IndexedDB open failed'));request.onsuccess=()=>{db=request.result;try{const tx=db.transaction('probe','readwrite'),store=tx.objectStore('probe'),value='local-test';store.put(value,'roundtrip');const read=store.get('roundtrip');read.onsuccess=()=>{if(read.result!==value)tx.abort();};tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error??Error('IndexedDB transaction failed'));tx.onabort=()=>reject(tx.error??Error('IndexedDB transaction aborted'));}catch(error){reject(error);}};});}
 catch(error){testError=error;}
 finally{db?.close();}
 try{await new Promise<void>((resolve,reject)=>{const request=factory.deleteDatabase(name);request.onsuccess=()=>resolve();request.onerror=()=>reject(request.error??Error('IndexedDB cleanup failed'));request.onblocked=()=>reject(Error('IndexedDB cleanup blocked'));});}
 catch(error){throw Error(`Temporary IndexedDB cleanup failed: ${error instanceof Error?error.message:'blocked'}`);}
 if(testError)throw testError;
 return true;
}

async function adapterAvailable(gpu:NonNullable<DiagnosticEnvironment['gpu']>):Promise<boolean>{
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{return await Promise.race([gpu.requestAdapter().then(Boolean),new Promise<boolean>(resolve=>{timer=setTimeout(()=>resolve(false),8000);})]);}
 catch{return false;}finally{if(timer)clearTimeout(timer);}
}

/** Runs bounded, local-only environment checks. It never reads knowledge records or model output. */
export async function runDeviceDiagnostics(env:DiagnosticEnvironment={}):Promise<DeviceDiagnosticReport>{
 const now=env.now??(()=>new Date()),checks:DiagnosticCheck[]=[];
 const add=(id:string,status:DiagnosticCheck['status'],detail:string)=>checks.push({id,status,detail:detail.slice(0,180)});
 const secure=env.isSecureContext??globalThis.isSecureContext;
 add('secure-context',secure?'pass':'fail',secure?'Secure context available':'Secure context required for PWA capabilities');
 const controller=env.serviceWorker===undefined?(typeof navigator!=='undefined'?navigator.serviceWorker:undefined):env.serviceWorker;
 add('service-worker',controller?.controller?'pass':'fail',controller?.controller?'This page is controlled by a service worker':'No active service worker controls this page');
 add('app-build',env.appBuild&&env.appBuild!=='Unknown'&&env.appBuild!=='Unavailable'?'pass':'warning',env.appBuild??'Build identity unavailable');

 const cache=env.cacheStorage===undefined?(typeof caches!=='undefined'?caches:undefined):env.cacheStorage;
 try{const keys=cache?await cache.keys():[];add('offline-cache',keys.length?'pass':'warning',keys.length?`${keys.length} cache bucket(s) present; offline restart not proven`:'No app cache bucket detected');}
 catch{add('offline-cache','warning','Cache storage could not be inspected');}

 const storage=env.storage===undefined?(typeof localStorage!=='undefined'?localStorage:undefined):env.storage;
 if(!storage)add('storage-roundtrip','fail','Local storage unavailable');
 else {const key=`babelshelf.diagnostic-probe.${probeId()}`;try{storage.setItem(key,'ok');const passed=storage.getItem(key)==='ok';storage.removeItem(key);add('storage-roundtrip',passed?'pass':'fail',passed?'Temporary local write/read/remove passed':'Temporary local roundtrip failed');}catch{try{storage.removeItem(key);}catch{}add('storage-roundtrip','fail','Temporary local storage probe failed');}}

 const idb=env.indexedDB===undefined?(typeof indexedDB!=='undefined'?indexedDB:undefined):env.indexedDB;
 if(!idb)add('indexeddb-roundtrip','fail','IndexedDB unavailable');
 else {const name=`babelshelf-diagnostic-${probeId()}`;try{await indexedDbProbe(idb,name);add('indexeddb-roundtrip','pass','Temporary isolated database write/read/delete passed');}catch(error){add('indexeddb-roundtrip','fail',error instanceof Error?error.message:'IndexedDB roundtrip failed');}}

 const gpu=env.gpu===undefined?(globalThis.navigator as Navigator&{gpu?:NonNullable<DiagnosticEnvironment['gpu']>}|undefined)?.gpu:env.gpu;
 if(!gpu)add('webgpu','not-run','WebGPU API unavailable; CPU/WASM may still be supported');
 else {const available=await adapterAvailable(gpu);add('webgpu',available?'pass':'warning',available?'Adapter available; model execution and memory fit not tested':'Adapter unavailable or timed out');}
 if(!env.selectedModel)add('selected-model','not-run','No text model selected');
 else if(!env.modelFilesPresent)add('selected-model','warning',`${env.selectedModel}: model files not verified`);
 else add('selected-model',env.modelLoaded?'pass':'warning',`${env.selectedModel}: files verified${env.modelLoaded?' and model loaded':' ; generation not tested'}`);

 const platform=(env.platform??(typeof navigator!=='undefined'?navigator.platform:'Unknown')).slice(0,80);
 const userAgent=(env.userAgent??(typeof navigator!=='undefined'?navigator.userAgent:'Unknown')).slice(0,240);
 return {schema:1,createdAt:now().toISOString(),appBuild:(env.appBuild??'Unknown').slice(0,40),bundle:(env.bundle??'Unknown').slice(0,100),platform,userAgent,standalone:env.standalone??(typeof matchMedia==='function'&&matchMedia('(display-mode: standalone)').matches),connectionMode:env.connectionMode??'offline',onlineSignal:env.online??(typeof navigator!=='undefined'&&navigator.onLine),checks,manualSteps:['Switch iPhone to Airplane Mode.','Force-close BabelShelf, then reopen it from the Home Screen.','Run this test again and confirm the app opens and local tasks still work.'],scope:['Checks run in this PWA on this device.','Online status is only a browser signal; cached assets do not prove a successful offline cold launch.','This run does not inspect knowledge files, prompts, model output, or send data.','Model readiness is not a generation, quality, thermal, or sustained-performance test.']};
}

export function formatDeviceDiagnosticReport(report:DeviceDiagnosticReport):string{return JSON.stringify(report,null,2);}
