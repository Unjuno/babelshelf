export class VisionClient{
 private worker:any=null;private sequence=0;private pending:{type:string;resolve:(v:any)=>void;reject:(e:Error)=>void}|null=null;
 private factory:()=>any;private update:(busy:boolean,progress?:string)=>void;
 private beforeDescribe?: (check:()=>void)=>Promise<void>;
 constructor(factory:()=>any,update:(busy:boolean,progress?:string)=>void,beforeDescribe?:(check:()=>void)=>Promise<void>){this.factory=factory;this.update=update;this.beforeDescribe=beforeDescribe;}
 private dispatch(type:string,values:any,id:number){
  if(!this.worker){const worker=this.factory();this.worker=worker;
   worker.onmessage=({data}:any)=>{
    if(this.worker!==worker||data.id!==this.sequence||!this.pending)return;
    if(data.progress){this.update(this.pending.type!=='status',data.progress);return;}
    const pending=this.pending;this.pending=null;
    // The image model owns one reading operation; storage owns prepared assets.
    if(pending.type==='describe'){this.worker=null;worker.terminate();}
    this.update(false,data.error);
    if(data.error)pending.reject(Error(data.error));else pending.resolve(data.value);
   };
   worker.onerror=()=>{if(this.worker!==worker)return;this.worker=null;worker.terminate();const pending=this.pending;this.pending=null;this.update(false,'Vision runtime failed');pending?.reject(Error('Vision runtime failed'));};
  }
  this.worker.postMessage({...values,id,type});
 }
 call(type:string,values:any={}):Promise<any>{
  if(this.pending)return Promise.reject(Error('Vision model busy'));
  const id=++this.sequence;
  return new Promise((resolve,reject)=>{
   this.pending={type,resolve,reject};this.update(type!=='status');
   const check=()=>{if(id!==this.sequence||!this.pending)throw Error('Stopped');};
   const fail=(error:unknown)=>{if(id!==this.sequence||!this.pending)return;const pending=this.pending;this.pending=null;this.update(false,(error as Error).message);pending.reject(error as Error);};
   if(type==='describe'&&this.beforeDescribe){
    // Reserve the request throughout release, so Stop and a second request
    // cannot start a delayed image load after this operation has ended.
    void(async()=>{try{await this.beforeDescribe!(check);check();this.dispatch(type,values,id);}catch(error){fail(error);}})();
   }else{try{this.dispatch(type,values,id);}catch(error){fail(error);}}
  });
 }
 stop(){this.sequence++;this.worker?.terminate();this.worker=null;const pending=this.pending;this.pending=null;this.update(false,'Stopped');pending?.reject(Error('Stopped'));}
}
