// Application routing policy for one submitted turn. Model adapters, UI state,
// activity persistence and action execution remain behind caller-owned ports.
export type TurnSelection<Request>={request:Request|null;reason:string};
export type TurnRoute<Request>=
 |{request:Request;source:'explicit'}
 |{request:Request;source:'decision';reason:string}
 |{request:Request;source:'planner';decisionReason?:string}
 |{request:null;source:'none';decisionReason?:string};

export async function resolveTurnRoute<Request>(input:{
 current:Request|null;
 question:string;
 select?:()=>Promise<TurnSelection<Request>>;
 plan?:()=>Promise<Request>;
 check:()=>void;
}):Promise<TurnRoute<Request>>{
 input.check();
 if(input.current!==null)return {request:input.current,source:'explicit'};
 if(!input.question)return {request:null,source:'none'};
 let decisionReason:string|undefined;
 if(input.select){
  const selected=await input.select();input.check();decisionReason=selected.reason;
  if(selected.request!==null)return {request:selected.request,source:'decision',reason:selected.reason};
 }
 if(!input.plan)return {request:null,source:'none',...(decisionReason?{decisionReason}:{})};
 const request=await input.plan();input.check();return {request,source:'planner',...(decisionReason?{decisionReason}:{})};
}
