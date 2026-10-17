export type StoragePort={estimate?:()=>Promise<{usage?:number;quota?:number}>;persisted?:()=>Promise<boolean>;persist?:()=>Promise<boolean>};
export type DeviceStorage={usage:number|null;quota:number|null;available:number|null;persistent:boolean|null;canRequest:boolean};
const measured=(v:unknown):number|null=>typeof v==='number'&&Number.isFinite(v)&&v>=0?v:null;
// Browser estimates only: not physical free disk, RAM, readiness or guaranteed capacity.
export async function readDeviceStorage(storage:StoragePort|undefined=globalThis.navigator?.storage):Promise<DeviceStorage>{
 const [estimate,persisted]=await Promise.allSettled([Promise.resolve().then(()=>storage?.estimate?.()),Promise.resolve().then(()=>storage?.persisted?.())]);
 const value=estimate.status==='fulfilled'?estimate.value:undefined,usage=measured(value?.usage),quota=measured(value?.quota),protection=persisted.status==='fulfilled'?persisted.value:undefined;
 return {usage,quota,available:usage!==null&&quota!==null?Math.max(0,quota-usage):null,persistent:typeof protection==='boolean'?protection:null,canRequest:typeof storage?.persist==='function'};
}
// Called only from an explicit user action. Never invoked by status reads or restore.
export async function requestStorageProtection(storage:StoragePort|undefined=globalThis.navigator?.storage){
 let outcome:'granted'|'not-granted'|'unsupported'='unsupported';
 if(typeof storage?.persist==='function'){try{outcome=await storage.persist()===true?'granted':'not-granted';}catch{outcome='not-granted';}}
 return {outcome,state:await readDeviceStorage(storage)};
}
export function storageBytes(value:number|null){if(value===null)return 'Unknown';if(value>=1e9)return (value/1e9).toFixed(1)+' GB';if(value>=1e6)return (value/1e6).toFixed(1)+' MB';if(value>=1000)return Math.round(value/1000)+' KB';return Math.round(value)+' B';}
