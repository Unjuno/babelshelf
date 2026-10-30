import {validateActivity,type Activity} from './harness-activity.ts';

// New records coexist with inline legacy turn.activity; no migration deletes or
// rewrites old receipts. The production tracer pages new overflow events here.
export const TURN_ACTIVITY_PAGE_SIZE=16;
const prefix='ui-v1-turn-activity-';
function part(value:string){if(typeof value!=='string'||!value||value.length>100)throw Error('Invalid activity identity');try{return encodeURIComponent(value);}catch{throw Error('Invalid activity identity');}}
export const turnActivityMetaKey=(turnId:string)=>`${prefix}meta:${part(turnId)}`;
export const turnActivityPageKey=(turnId:string,page:number)=>{if(!Number.isSafeInteger(page)||page<0||page>999_999_999_999)throw Error('Invalid activity page');return `${prefix}page:${part(turnId)}:${String(page).padStart(12,'0')}`;};
export const turnActivityIndexKey=(turnId:string,id:string)=>`${prefix}item:${part(turnId)}:${part(id)}`;
export const turnActivityPagePrefix=(turnId:string)=>`${prefix}page:${part(turnId)}:`;
export type TurnActivityMeta={schema:1;type:'turn-activity-meta';turnId:string;count:number};
export type TurnActivityPage={schema:1;type:'turn-activity-page';turnId:string;page:number;items:Activity[]};
export type TurnActivityIndex={schema:1;type:'turn-activity-index';turnId:string;id:string;page:number};
const exact=(v:object,keys:string[])=>Object.keys(v).sort().join('|')===keys.sort().join('|');
export function validateTurnActivityMeta(key:string,value:any):asserts value is TurnActivityMeta{
 if(!value||!exact(value,['schema','type','turnId','count'])||value.schema!==1||value.type!=='turn-activity-meta'||key!==turnActivityMetaKey(value.turnId)||!Number.isSafeInteger(value.count)||value.count<1||Math.floor((value.count-1)/TURN_ACTIVITY_PAGE_SIZE)>999_999_999_999)throw Error('Invalid activity metadata');
}
export function validateTurnActivityPage(key:string,value:any):asserts value is TurnActivityPage{
 if(!value||!exact(value,['schema','type','turnId','page','items'])||value.schema!==1||value.type!=='turn-activity-page'||key!==turnActivityPageKey(value.turnId,value.page)||!Array.isArray(value.items)||!value.items.length||value.items.length>TURN_ACTIVITY_PAGE_SIZE)throw Error('Invalid activity page');
 validateActivity(value.items);
}
export function validateTurnActivityIndex(key:string,value:any):asserts value is TurnActivityIndex{
 if(!value||!exact(value,['schema','type','turnId','id','page'])||value.schema!==1||value.type!=='turn-activity-index'||key!==turnActivityIndexKey(value.turnId,value.id)||!Number.isSafeInteger(value.page)||value.page<0)throw Error('Invalid activity index');
}

/** Backup validation rejects missing pages, duplicate IDs and dangling indexes. */
export function validateTurnActivityBackup(settings:{key:string;value:any}[],runs:{key:string;value:any}[]){
 const entries=runs.filter(({key,value})=>key.startsWith(prefix)||['turn-activity-meta','turn-activity-page','turn-activity-index'].includes(value?.type));
 if(!entries.length)return;
 const dialogue=settings.find(entry=>entry.key==='ui-v1-dialogue')?.value,turns=new Map<string,any>((dialogue?.turns??[]).map((turn:any)=>[turn.id,turn]));
 const metas=new Map<string,TurnActivityMeta>(),pages=new Map<string,TurnActivityPage[]>(),indexes=new Map<string,TurnActivityIndex>();
 for(const {key,value} of entries){
  if(value?.type==='turn-activity-meta'){validateTurnActivityMeta(key,value);if(metas.has(value.turnId))throw Error('Duplicate activity metadata');metas.set(value.turnId,value);}
  else if(value?.type==='turn-activity-page'){validateTurnActivityPage(key,value);const list=pages.get(value.turnId)??[];list.push(value);pages.set(value.turnId,list);}
  else if(value?.type==='turn-activity-index'){validateTurnActivityIndex(key,value);if(indexes.has(key))throw Error('Duplicate activity index');indexes.set(key,value);}
  else throw Error('Invalid activity record');
 }
 let total=0;
 for(const [turnId,meta] of metas){
  const turn=turns.get(turnId);if(!turn)throw Error('Activity turn unavailable');
  const list=(pages.get(turnId)??[]).sort((a,b)=>a.page-b.page),ids=new Set<string>((turn.activity??[]).map((a:Activity)=>a.id));let count=0;
  for(let i=0;i<list.length;i++){const page=list[i];if(page.page!==i||i<list.length-1&&page.items.length!==TURN_ACTIVITY_PAGE_SIZE)throw Error('Incomplete activity pages');
   for(const activity of page.items){if(ids.has(activity.id))throw Error('Duplicate activity identity');ids.add(activity.id);const idx=indexes.get(turnActivityIndexKey(turnId,activity.id));if(!idx||idx.page!==i)throw Error('Activity index unavailable');count++;}
  }
  if(count!==meta.count||count===0)throw Error('Activity count mismatch');total+=count;pages.delete(turnId);
 }
 if(pages.size||total!==indexes.size)throw Error('Orphan activity record');
}
