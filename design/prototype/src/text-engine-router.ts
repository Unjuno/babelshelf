import {combinedTextManifest,isOnnxText,onnxTextManifest} from './text-model-manifest.ts';
type Backend={manifest:any;loaded?:string|null;failed?:boolean;init:()=>Promise<any>;call:(cmd:string,args?:any,events?:any)=>Promise<any>;load:(id:string,events?:any)=>Promise<any>;unload:()=>Promise<any>;abort:()=>void;worker:{terminate:()=>void}};
// One active text engine. Only the app constructs adapters; records cannot supply code.
export class TextEngineRouter{
 private onnx:Backend|null=null;
 private active:Backend|null=null;
 private base:any;
 private onnxAssets:any={};
 private epoch=0;
 private webml:Backend;private createOnnx:()=>Backend;
 constructor(webml:Backend,createOnnx:()=>Backend){this.webml=webml;this.createOnnx=createOnnx;this.base=webml.manifest;}
 get manifest(){return combinedTextManifest(this.base,this.loaded??'');}
 set manifest(value:any){this.base=value;this.webml.manifest=value;}
 get loaded(){return this.active?.loaded??null;}
 private discardFailed(){if(this.onnx?.failed){if(this.active===this.onnx)this.active=null;this.onnx=null;}}
 private backend(id:string){this.discardFailed();if(!isOnnxText(id))return this.webml;return this.onnx??=this.createOnnx();}
 private check(epoch:number){if(epoch!==this.epoch)throw Error('Stopped');}
 private async status(){const epoch=this.epoch;const onnxAssets=await this.backend(onnxTextManifest.id).call('status');this.check(epoch);const webmlAssets=await this.webml.call('status');this.check(epoch);this.onnxAssets=onnxAssets;return {...webmlAssets,...onnxAssets};}
 async init(){return this.webml.init();}
 async call(cmd:string,args:any={},events?:any):Promise<any>{
  if(cmd==='status')return this.status();
  if(cmd==='configure'){const epoch=this.epoch,assets=await this.webml.call(cmd,args,events);this.check(epoch);const onnxAssets=await this.backend(onnxTextManifest.id).call('status');this.check(epoch);this.onnxAssets=onnxAssets;return {...assets,...onnxAssets};}
  if(cmd==='count'){if(!this.active?.loaded)throw Error('Model not loaded');return this.active.call(cmd,args,events);}
  if(cmd==='prepare')return this.backend(args.model).call(cmd,args,events);
  throw Error('Unknown text operation');
 }
 async load(id:string,events?:any){
  const epoch=this.epoch,backend=this.backend(id);
  if(this.active){const old=this.active;this.active=null;await old.unload();}
  if(epoch!==this.epoch)throw Error('Stopped');
  // Active is set before awaiting so Stop can terminate a loading WASM worker.
  this.active=backend;
  try{const result=await backend.load(id,events);if(epoch!==this.epoch)throw Error('Stopped');return result;}
  catch(error){if(this.active===backend)this.active=null;throw error;}
 }
 async unload(){this.discardFailed();const epoch=this.epoch,old=this.active;this.active=null;if(old)await old.unload();if(epoch!==this.epoch)throw Error('Stopped');}
 generate(messages:any[],events?:any,maxTokens=256){if(!this.active?.loaded)return Promise.reject(Error('Model not loaded'));return this.active.call('generate',{messages,maxTokens},events);}
 abort(){
  this.epoch++;this.webml.abort();
  // WASM may block its worker event loop. Termination rejects all pending commands.
  if(this.onnx){const old=this.onnx;this.onnx=null;if(this.active===old)this.active=null;old.abort();old.worker.terminate();}
 }
 worker={terminate:()=>{this.webml.worker.terminate();this.onnx?.worker.terminate();this.onnx=null;this.active=null;}};
}
