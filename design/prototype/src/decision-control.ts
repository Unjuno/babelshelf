export class DecisionClient {
 private worker:any=null;private sequence=0;private timer:ReturnType<typeof setTimeout>|undefined;
 private pending:{type:string;cancelled:boolean;resolve:(v:any)=>void;reject:(e:Error)=>void}|null=null;
 private onReset:()=>void;private factory:()=>any;private update:(busy:boolean,progress?:string)=>void;
 constructor(factory:()=>any,update:(busy:boolean,progress?:string)=>void,onReset:()=>void=()=>{}){this.factory=factory;this.update=update;this.onReset=onReset;}
 get active(){return !!this.worker;}
 get working(){return !!this.pending;}
 private discard(message:string){clearTimeout(this.timer);this.timer=undefined;this.sequence++;this.worker?.terminate();this.worker=null;this.onReset();const p=this.pending;this.pending=null;this.update(false,message);p?.reject(Error(message));}
 async call(type:string,values:any={}):Promise<any>{
  if(this.pending)throw Error('Decision model busy');
  if(!this.worker){const w=this.factory();this.worker=w;
   w.onmessage=({data}:any)=>{if(this.worker!==w||data.id!==this.sequence||!this.pending)return;if(data.progress){this.update(true,this.pending.cancelled?'Stopping':data.progress);return;}clearTimeout(this.timer);this.timer=undefined;const p=this.pending;this.pending=null;const error=p.cancelled?'Stopped':data.error;if(p.type==='classify'){this.worker=null;w.terminate();this.onReset();}this.update(false,error);if(error)p.reject(Object.assign(Error(error),!p.cancelled&&data.code==='decision_context_limit'?{code:data.code}:{}));else p.resolve(data.value);};
   w.onerror=()=>{if(this.worker===w)this.discard('Decision runtime failed');};
  }
  this.update(true);return new Promise((resolve,reject)=>{this.pending={type,cancelled:false,resolve,reject};try{this.worker.postMessage({...values,id:++this.sequence,type});}catch(e){this.discard((e as Error).message||'Decision runtime failed');}});
 }
 stop(){
  if(this.pending?.type==='prepare'){
   if(this.pending.cancelled)return;this.pending.cancelled=true;this.update(true,'Stopping');try{this.worker.postMessage({type:'abort'});}catch{this.discard('Stopped');return;}this.timer=setTimeout(()=>this.discard('Stopped'),2500);return;
  }
  this.discard('Stopped');
 }
 dispose(){this.discard('Stopped');}
}
