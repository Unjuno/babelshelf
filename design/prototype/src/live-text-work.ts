export type LiveTextWorkReceipt={kind:'count'|'generate';startedAt:number;updatedAt:number;phase:string};

/** Elapsed time is scoped to the current model call, not the full user operation. */
export function modelStepElapsedSeconds(now:number,startedAt:number){
 return Math.max(0,Math.floor((now-startedAt)/1000));
}

export function elapsedDurationLabel(seconds:number){
 const elapsed=Math.max(0,Math.floor(seconds));
 if(elapsed>=3600)return `${Math.floor(elapsed/3600)}h ${String(Math.floor(elapsed%3600/60)).padStart(2,'0')}m`;
 if(elapsed>=60)return `${Math.floor(elapsed/60)}m ${String(elapsed%60).padStart(2,'0')}s`;
 return `${elapsed}s`;
}

/** Show measured model work for any user-visible operation that owns it. */
export function shouldShowLiveTextWork(work:LiveTextWorkReceipt|null,submissionActive:boolean,scheduledRunActive:boolean){
 return work!==null&&(submissionActive||scheduledRunActive);
}
