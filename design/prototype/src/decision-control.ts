function plainRecord(value:unknown):value is Record<string,unknown>{return !!value&&typeof value==='object'&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);}
function exactKeys(value:Record<string,unknown>,keys:readonly string[]){const actual=Object.keys(value).sort(),expected=[...keys].sort();return actual.length===expected.length&&actual.every((key,index)=>key===expected[index]);}
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
   w.onmessage=({data}:MessageEvent<unknown>)=>{
    if(this.worker!==w||!this.pending)return;
    if(!plainRecord(data)||!Number.isSafeInteger(data.id)||Number(data.id)<1||Number(data.id)>this.sequence){this.discard('Decision runtime failed');return;}
    if(data.id!==this.sequence)return;
    if(Object.hasOwn(data,'progress')){if(!exactKeys(data,['id','progress'])||typeof data.progress!=='string'){this.discard('Decision runtime failed');return;}this.update(true,this.pending.cancelled?'Stopping':data.progress);return;}
    const hasError=Object.hasOwn(data,'error'),hasValue=Object.hasOwn(data,'value');
    if(hasError){const keys=Object.hasOwn(data,'code')?['id','error','code']:['id','error'];if(!exactKeys(data,keys)||typeof data.error!=='string'||Object.hasOwn(data,'code')&&data.code!=='decision_context_limit'){this.discard('Decision runtime failed');return;}}
    else if(!hasValue||!exactKeys(data,['id','value'])){this.discard('Decision runtime failed');return;}
    clearTimeout(this.timer);this.timer=undefined;const p=this.pending;this.pending=null;const error=p.cancelled?'Stopped':hasError?data.error as string:undefined;if(p.type==='classify'){this.worker=null;w.terminate();this.onReset();}this.update(false,error);if(error)p.reject(Object.assign(Error(error),!p.cancelled&&data.code==='decision_context_limit'?{code:data.code}:{}));else p.resolve(data.value);
   };
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
