// Explicit HF UI operations authorize one exact GET through the offline shell.
// This never grants persistent connectivity or permits inference/data uploads.
export async function allowHuggingFaceRequest(url:string,range:string,controller:Pick<ServiceWorker,'postMessage'>|null|undefined,signal?:AbortSignal,timeout=5000){
 signal?.throwIfAborted();if(!controller)return;
 await new Promise<void>((resolve,reject)=>{
  const channel=new MessageChannel();let timer:ReturnType<typeof setTimeout>;
  const cleanup=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);channel.port1.close();channel.port2.close();};
  const abort=()=>{cleanup();reject(signal?.reason??Error('Stopped'));};
  signal?.addEventListener('abort',abort,{once:true});
  timer=setTimeout(()=>{cleanup();reject(Error('App update required · model downloads not connected'));},timeout);
  channel.port1.onmessage=({data})=>{cleanup();if(data?.allowed===true)resolve();else reject(Error('Model request not allowed'));};
  try{controller.postMessage({type:'allow-huggingface-request',url,range},[channel.port2]);}catch(error){cleanup();reject(error);}
 });
 signal?.throwIfAborted();
}
export const fetchHuggingFace:typeof fetch=async(input,init)=>{
 const url=String(input),headers=new Headers(init?.headers);
 await allowHuggingFaceRequest(url,headers.get('Range')??'',globalThis.navigator?.serviceWorker?.controller,init?.signal??undefined);
 return fetch(input,init);
};
