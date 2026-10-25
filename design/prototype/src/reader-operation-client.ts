import type {InferenceLease} from './inference-lease.ts';

type Pending = {
 id:number; type:string; resolve:(value:any)=>void; reject:(error:unknown)=>void;
 lease?:InferenceLease; starting?:Promise<void>; finishing:boolean;
};

// Reserve before any await. A terminal operation owns its cleanup until both
// worker termination and lease release finish; stale continuations never own
// a later operation's resources.
export class ReaderOperationClient {
 private worker:any=null;
 private sequence=0;
 private pending:Pending|null=null;
 private label:string;private inferenceType:string;
 private factory:()=>any;private update:(busy:boolean,progress?:string)=>void;
 private before?: (check:()=>void)=>Promise<void>;
 private acquire?:()=>Promise<InferenceLease>;
 constructor(
  label:string, inferenceType:string,
  factory:()=>any, update:(busy:boolean,progress?:string)=>void,
  before?: (check:()=>void)=>Promise<void>,
  acquire?:()=>Promise<InferenceLease>,
 ){this.label=label;this.inferenceType=inferenceType;this.factory=factory;this.update=update;this.before=before;this.acquire=acquire;}
 private finish(operation:Pending,value?:any,error?:unknown){
  if(operation.finishing)return;
  operation.finishing=true;
  if(this.pending===operation && (operation.type===this.inferenceType || error)){
   const worker=this.worker;this.worker=null;worker?.terminate();
  }
  const complete=(failure?:unknown)=>{
   if(this.pending===operation){this.pending=null;this.update(false,failure instanceof Error?failure.message:undefined);}
   if(failure)operation.reject(failure);else operation.resolve(value);
  };
  if(operation.starting || operation.lease){
   void(async()=>{
    try{await operation.starting?.catch(()=>{});await operation.lease?.release();complete(error);}
    catch(cleanupError){complete(error??cleanupError);}
   })();
  }else complete(error);
 }
 private dispatch(operation:Pending,values:any){
  if(!this.worker){
   const worker=this.factory();this.worker=worker;
   worker.onerror=()=>{
    if(this.worker!==worker)return;
    const current=this.pending;if(current)this.finish(current,undefined,Error(`${this.label} runtime failed`));
   };
  }
  // Status/prepare workers may be reused, so their listener must follow the
  // current request rather than the request that originally created them.
  const worker=this.worker;
  worker.onmessage=({data}:any)=>{
   if(this.worker!==worker || this.pending!==operation || operation.finishing || data.id!==operation.id)return;
   if(data.progress){this.update(operation.type!=='status',data.progress);return;}
   this.finish(operation,data.value,data.error?Error(data.error):undefined);
  };
  worker.postMessage({...values,id:operation.id,type:operation.type});
 }
 call(type:string,values:any={}):Promise<any>{
  if(this.pending)return Promise.reject(Error(`${this.label} model busy`));
  const id=++this.sequence;
  return new Promise((resolve,reject)=>{
   const operation:Pending={id,type,resolve,reject,finishing:false};this.pending=operation;this.update(type!=='status');
   const check=()=>{if(this.pending!==operation || id!==this.sequence || operation.finishing)throw Error('Stopped');};
   if(type===this.inferenceType && (this.before || this.acquire)){
    operation.starting=(async()=>{
     check();await this.before?.(check);check();
     if(this.acquire){operation.lease=await this.acquire();check();}
    })();
    void operation.starting.then(()=>{check();this.dispatch(operation,values);}).catch(error=>this.finish(operation,undefined,error));
   }else{try{this.dispatch(operation,values);}catch(error){this.finish(operation,undefined,error);}}
  });
 }
 stop(){
  this.sequence++;
  if(this.pending){
   // Cancellation is observable immediately, but the reservation stays held
   // until any late lease acquisition has been released.
   this.pending.reject(Error('Stopped'));this.finish(this.pending,undefined,Error('Stopped'));
  }
  else{const worker=this.worker;this.worker=null;worker?.terminate();this.update(false,'Stopped');}
 }
}
