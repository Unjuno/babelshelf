// Local, on-demand failure evidence. Never a retry instruction or execution input.
export class PlannerOutputError extends Error {
 readonly diagnostic:{raw:string;reason:string;truncated:boolean};
 constructor(message:string,raw:string,reason:string){
  super(message);this.name='PlannerOutputError';
  this.diagnostic={raw:raw.slice(0,8192),reason,truncated:raw.length>8192};
 }
}
