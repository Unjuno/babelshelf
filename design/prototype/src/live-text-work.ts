export type LiveTextWorkReceipt={kind:'count'|'generate';startedAt:number;updatedAt:number;phase:string};

/** Show measured model work for any user-visible operation that owns it. */
export function shouldShowLiveTextWork(work:LiveTextWorkReceipt|null,submissionActive:boolean,scheduledRunActive:boolean){
 return work!==null&&(submissionActive||scheduledRunActive);
}
