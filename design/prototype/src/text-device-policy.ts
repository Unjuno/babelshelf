type DeviceSignals={userAgent?:string;mobile?:boolean};

/** Browser signals identify known phones; unknown platforms are not a memory estimate. */
export function isPhoneDevice(signals:DeviceSignals):boolean{
 return signals.mobile===true||/iPhone|iPod|Android/i.test(signals.userAgent??'');
}
export function currentDeviceSignals():DeviceSignals{
 const nav=globalThis.navigator as (Navigator&{userAgentData?:{mobile?:boolean}})|undefined;
 return {userAgent:nav?.userAgent,mobile:nav?.userAgentData?.mobile};
}
export function textBackendPolicy(signals:DeviceSignals):'webgpu'|'auto'{return isPhoneDevice(signals)?'webgpu':'auto';}
export function assertTextRouteAllowed(route:{backend:'webgpu'|'cpu-wasm'}|null,signals:DeviceSignals):void{
 if(isPhoneDevice(signals)&&route?.backend==='cpu-wasm')throw Error('This text model needs a WebGPU runtime on a phone');
}
