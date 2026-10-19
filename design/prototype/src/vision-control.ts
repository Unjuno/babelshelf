export class VisionClient{
 private worker:any=null;private sequence=0;private pending:{type:string;resolve:(v:any)=>void;reject:(e:Error)=>void}|null=null;
 private factory:()=>any;private update:(busy:boolean,progress?:string)=>void;
 constructor(factory:()=>any,update:(busy:boolean,progress?:string)=>void){this.factory=factory;this.update=update;}
 call(type:string,values:any={}):Promise<any>{
  if(this.pending)return Promise.reject(Error('Vision model busy'));
  if(!this.worker){const worker=this.factory();this.worker=worker;
   worker.onmessage=({data}:any)=>{if(this.worker!==worker||data.id!==this.sequence)return;if(data.progress){this.update(this.pending?.type!=='status',data.progress);return;}const pending=this.pending;this.pending=null;this.update(false,data.error);if(data.error)pending?.reject(Error(data.error));else pending?.resolve(data.value);};
   worker.onerror=()=>{if(this.worker!==worker)return;this.worker=null;worker.terminate();const pending=this.pending;this.pending=null;this.update(false,'Vision runtime failed');pending?.reject(Error('Vision runtime failed'));};
  }
  this.update(type!=='status');return new Promise((resolve,reject)=>{this.pending={type,resolve,reject};this.worker.postMessage({id:++this.sequence,type,...values});});
 }
 stop(){this.sequence++;this.worker?.terminate();this.worker=null;const pending=this.pending;this.pending=null;this.update(false,'Stopped');pending?.reject(Error('Stopped'));}
}
