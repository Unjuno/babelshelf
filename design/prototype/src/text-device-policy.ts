type DeviceHints={userAgent?:string;userAgentData?:{mobile?:boolean};maxTouchPoints?:number};
/** Mobile browsers must use the registered WebGPU route; they must not hide a
 * failed GPU load behind a likely unusable CPU fallback. Desktop keeps the
 * existing automatic GPU-first/CPU fallback. These are route policies, not
 * claims that a model fits or that the browser's probed adapter is in use.
 */
export function textBackendPolicy(hints:DeviceHints=typeof navigator==='undefined'?{}:navigator):'auto'|'webgpu' {
 const userAgent=typeof hints.userAgent==='string'?hints.userAgent:'';
 const mobile=hints.userAgentData?.mobile===true||/Android|iPhone|iPad|iPod|Mobile/i.test(userAgent)||(/Macintosh|Mac OS X/i.test(userAgent)&&(hints.maxTouchPoints??0)>1);
 return mobile?'webgpu':'auto';
}
