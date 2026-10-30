import type {ToolHost} from '../tool-host.ts';

export const definition=Object.freeze({id:'time.now',version:1,effect:'read',network:'none',inputSchema:{type:'object',required:[],additionalProperties:false,properties:{}}});
export type ClockReading={instant:string;localTime:string;offsetMinutes:number;timeZone:string|null;source:'device-clock'};
export function validateClockReading(value:unknown):ClockReading{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid device clock reading');
 const v=value as Record<string,unknown>;
 if(Object.keys(v).sort().join(',')!=='instant,localTime,offsetMinutes,source,timeZone'||typeof v.instant!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v.instant)||!Number.isFinite(Date.parse(v.instant))||new Date(v.instant).toISOString()!==v.instant||typeof v.offsetMinutes!=='number'||!Number.isInteger(v.offsetMinutes)||v.offsetMinutes< -840||v.offsetMinutes>840||typeof v.localTime!=='string'||new Date(Date.parse(v.instant)+v.offsetMinutes*60000).toISOString().slice(0,19)!==v.localTime||v.timeZone!==null&&(typeof v.timeZone!=='string'||!v.timeZone||v.timeZone.length>128)||v.source!=='device-clock')throw Error('Invalid device clock reading');
 return v as ClockReading;
}

/** One device-clock reading; no claim of network synchronization or background execution. */
export async function run(args:unknown,host:ToolHost){
 if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).length)throw Error('Invalid clock request');
 host.check();const now=new Date(),instant=now.toISOString(),offsetMinutes=-now.getTimezoneOffset(),localTime=new Date(now.getTime()+offsetMinutes*60000).toISOString().slice(0,19);
 let timeZone:string|null=null;try{timeZone=Intl.DateTimeFormat().resolvedOptions().timeZone||null;}catch{/* time zone may be unavailable */}
 host.check();return validateClockReading({instant,localTime,offsetMinutes,timeZone,source:'device-clock'});
}
