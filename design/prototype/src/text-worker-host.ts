import type {TextRuntime} from './text-inference.ts';
type Runtime=TextRuntime&{unload:()=>Promise<void>};
type Message={id:number;cmd:string;args?:any};
// Host receives only an app-owned prepared runtime. It has no acquisition or write command.
export function createTextWorkerHost(readRuntime:(progress:(value:string)=>void,configuration?:any)=>Promise<Runtime>,send:(message:any)=>void,disposeChildren:()=>void=()=>{}){
 let disposed=false,busy=false,activeId:number|null=null,current:Runtime|undefined,ready:Promise<Runtime>|undefined;
 const progress=(value:string)=>{if(busy&&activeId!==null)send({id:activeId,type:'progress',value:String(value).slice(0,2000)});};
 const getRuntime=async(configuration?:any)=>{try{return await(ready??=Promise.resolve().then(()=>readRuntime(progress,configuration)));}catch(error){ready=undefined;throw error;}};
 return async({data}:{data:Message})=>{
  const {id,cmd,args={}}=data;if(id===0&&cmd==='dispose'){disposed=true;current?.stop();disposeChildren();send({id:0,type:'disposed'});return;}if(!Number.isSafeInteger(id)||id<1)return;if(disposed){send({id,type:'error',value:'Stopped'});return;}
  if(!['init','status','load','unload','count','generate'].includes(cmd)){send({id,type:'error',value:'Unknown text operation'});return;}
  if(busy){send({id,type:'error',value:'Model busy'});return;}busy=true;activeId=id;
  try{const runtime=await getRuntime(cmd==='init'?args:undefined);if(disposed)throw Error('Stopped');current=runtime;let value:any;
   if(cmd==='init'||cmd==='status')value=runtime.assets;
   else if(cmd==='load'){await runtime.load(args.model);value=true;}
   else if(cmd==='unload'){await runtime.unload();value=true;}
   else if(cmd==='count')value=await runtime.count(args.messages,args.format);
   else value=await runtime.generate(args.messages,args.maxTokens,args.format);
   if(disposed)throw Error('Stopped');send({id,type:'done',value});
  }catch(error){const d=(error as any)?.diagnostic;send({id,type:'error',value:String((error as Error)?.message??error).slice(0,2000),...(d&&typeof d.raw==='string'&&typeof d.reason==='string'?{diagnostic:{raw:d.raw.slice(0,8192),reason:d.reason.slice(0,100),truncated:d.truncated===true||d.raw.length>8192}}:{})});}
  finally{activeId=null;busy=false;}
 };
}
