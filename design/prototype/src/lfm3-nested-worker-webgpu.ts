const PREFERENCE_PRELUDE = `;(()=>{try{const navigatorObject=globalThis.navigator;if(!navigatorObject)return;const gpu=navigatorObject.gpu;if(!gpu||typeof gpu.requestAdapter!=="function")return;const requestAdapter=gpu.requestAdapter;const preferred=options=>{if(options?.powerPreference&&options.powerPreference!=="high-performance")return Promise.resolve().then(()=>requestAdapter.call(gpu,options));const high={...(options||{}),powerPreference:"high-performance"};return Promise.resolve().then(()=>requestAdapter.call(gpu,high)).then(adapter=>adapter||requestAdapter.call(gpu,options),()=>requestAdapter.call(gpu,options));};const wrapped=new Proxy(gpu,{get(target,key){return key==="requestAdapter"?preferred:Reflect.get(target,key,target)}});try{Object.defineProperty(navigatorObject,"gpu",{configurable:true,value:wrapped})}catch{const proto=globalThis.WorkerNavigator?.prototype;if(proto){const descriptor=Object.getOwnPropertyDescriptor(proto,"gpu");if(descriptor?.get)Object.defineProperty(proto,"gpu",{configurable:true,enumerable:descriptor.enumerable,get(){return wrapped}})}}}catch{}})();`;

function isWllamaRuntimeWorker(parts:BlobPart[],options?:BlobPropertyBag){
 if(options?.type?.toLowerCase().split(';',1)[0].trim()!=='text/javascript')return false;
 const source=parts.filter((part):part is string=>typeof part==='string').join('');
 return source.includes('function wModuleInit()')&&source.includes('RUN_OPTIONS');
}

/** Wllama creates a second worker for llama.cpp; install the app's GPU preference in that realm too. */
export function createLfm3WorkerAwareBlobClass(BaseBlob:typeof Blob):typeof Blob{
 return new Proxy(BaseBlob,{construct(target,args){
  const parts=Array.isArray(args[0])?args[0] as BlobPart[]:[];
  const options=args[1] as BlobPropertyBag|undefined;
  return Reflect.construct(target,[isWllamaRuntimeWorker(parts,options)?[PREFERENCE_PRELUDE,...parts]:parts,options],target);
 }});
}

export function installLfm3NestedWorkerWebGpuPreference(scope:typeof globalThis=globalThis){
 const NativeBlob=scope.Blob;
 if((NativeBlob as typeof Blob&{__babelShelfLfm3Preference?:boolean}).__babelShelfLfm3Preference)return;
 const PatchedBlob=createLfm3WorkerAwareBlobClass(NativeBlob) as typeof Blob&{__babelShelfLfm3Preference?:boolean};
 Object.defineProperty(PatchedBlob,'__babelShelfLfm3Preference',{value:true});
 scope.Blob=PatchedBlob;
}
