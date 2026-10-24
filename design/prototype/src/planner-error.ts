// Local, on-demand failure evidence. Never a retry instruction or execution input.
export class PlannerOutputError extends Error {
 readonly code='planner_protocol';
 readonly diagnostic:{raw:string;reason:string;truncated:boolean};
 constructor(message:string,raw:string,reason:string){
  super(message);this.name='PlannerOutputError';
  this.diagnostic={raw:raw.slice(0,8192),reason,truncated:raw.length>8192};
 }
}

/** Failure raised by the selected model adapter while planning a turn. */
export class ModelRuntimeError extends Error {
 readonly code='model_runtime';
 constructor(cause:unknown){super(cause instanceof Error?cause.message:'Model runtime failed');this.name='ModelRuntimeError';}
}
