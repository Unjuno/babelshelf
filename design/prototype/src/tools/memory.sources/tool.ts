import type {ToolHost} from '../tool-host.ts';
import {stateHash} from '../../backup-hash.ts';

export const definition=Object.freeze({id:'memory.sources',version:2,effect:'read',network:'none',inputSchema:{type:'object',required:['id','revision'],additionalProperties:false,properties:{id:{type:'string',minLength:1,maxLength:160},revision:{type:'integer',minimum:1},offset:{type:'integer',minimum:0,maximum:10000},limit:{type:'integer',minimum:1,maximum:12},snapshot:{type:'string',minLength:64,maxLength:64}}}});
export async function run(args:unknown,host:ToolHost){
 if(!args||typeof args!=='object'||Array.isArray(args))throw Error('Invalid source request');
 const a=args as Record<string,unknown>,offset=a.offset??0,limit=a.limit??12;
 if(Object.keys(a).some(key=>!['id','revision','offset','limit','snapshot'].includes(key))||typeof a.id!=='string'||!a.id||a.id.length>160||!Number.isSafeInteger(a.revision)||Number(a.revision)<1||!Number.isSafeInteger(offset)||Number(offset)<0||Number(offset)>10000||!Number.isSafeInteger(limit)||Number(limit)<1||Number(limit)>12||a.snapshot!==undefined&&(typeof a.snapshot!=='string'||!/^[a-f0-9]{64}$/.test(a.snapshot))||Number(offset)>0&&typeof a.snapshot!=='string')throw Error('Invalid source request');
 if(!host.sources)throw Error('Source metadata unavailable');
 host.check();const report=await host.sources(a.id,Number(a.revision),host.signal);host.check();
 if(report.noteId!==a.id||report.revision!==a.revision)throw Error('Source identity changed');
 const snapshot=stateHash(report);if(a.snapshot!==undefined&&a.snapshot!==snapshot)throw Error('Sources changed · restart');
 const items=report.items.slice(Number(offset),Number(offset)+Number(limit)),next=Number(offset)+items.length;
 const more=next<report.items.length,windowLimit=more&&next>10000;
 return {noteId:report.noteId,revision:report.revision,status:report.status,items,offset:Number(offset),limit:Number(limit),snapshot,nextOffset:more&&!windowLimit?next:null,...(windowLimit?{windowLimit:true}:{})};
}

export function validateSourcePage(value:unknown){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid source page');
 const v=value as Record<string,unknown>,keys=Object.keys(v).sort().join(',');
 if(!['items,limit,nextOffset,noteId,offset,revision,snapshot,status','items,limit,nextOffset,noteId,offset,revision,snapshot,status,windowLimit'].includes(keys)||v.windowLimit!==undefined&&v.windowLimit!==true||v.windowLimit===true&&(v.nextOffset!==null||Number(v.offset)+((v.items as unknown[])?.length??0)<=10000)||typeof v.noteId!=='string'||!v.noteId||v.noteId.length>160||!Number.isSafeInteger(v.revision)||Number(v.revision)<1||!['none','current','changed','removed','unavailable'].includes(v.status as string)||!Array.isArray(v.items)||!Number.isSafeInteger(v.limit)||Number(v.limit)<1||Number(v.limit)>12||v.items.length>Number(v.limit)||!Number.isSafeInteger(v.offset)||Number(v.offset)<0||Number(v.offset)>10000||typeof v.snapshot!=='string'||!/^[a-f0-9]{64}$/.test(v.snapshot)||v.nextOffset!==null&&v.nextOffset!==Number(v.offset)+v.items.length||v.nextOffset!==null&&(v.items.length!==Number(v.limit)||Number(v.nextOffset)>10000))throw Error('Invalid source page');
 for(const item of v.items){
  if(!item||typeof item!=='object'||Array.isArray(item))throw Error('Invalid source item');
  const r=item as Record<string,unknown>,fields=Object.keys(r).sort().join(',');
  if(!['end,historicalAvailable,noteId,path,revision,start,status','currentRevision,end,historicalAvailable,noteId,path,revision,start,status'].includes(fields)||typeof r.noteId!=='string'||!r.noteId||r.noteId.length>160||typeof r.path!=='string'||!r.path||r.path.length>1024||!Number.isSafeInteger(r.revision)||Number(r.revision)<1||!Number.isSafeInteger(r.start)||Number(r.start)<0||!Number.isSafeInteger(r.end)||Number(r.end)<=Number(r.start)||typeof r.historicalAvailable!=='boolean'||!['current','changed','removed','unavailable'].includes(r.status as string)||r.currentRevision!==undefined&&(!Number.isSafeInteger(r.currentRevision)||Number(r.currentRevision)<1))throw Error('Invalid source item');
 }
 return value;
}
