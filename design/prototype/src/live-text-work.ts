export type LiveTextWorkReceipt={kind:'count'|'generate';startedAt:number;updatedAt:number;phase:string};

/** Elapsed time is scoped to the current model call, not the full user operation. */
export function modelStepElapsedSeconds(now:number,startedAt:number){
 return Math.max(0,Math.floor((now-startedAt)/1000));
}

/** Show measured model work for any user-visible operation that owns it. */
export function shouldShowLiveTextWork(work:LiveTextWorkReceipt|null,submissionActive:boolean,scheduledRunActive:boolean){
 return work!==null&&(submissionActive||scheduledRunActive);
}
