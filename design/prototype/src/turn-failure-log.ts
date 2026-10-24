import {ActivityPersistenceError} from './harness-activity.ts';
import {appendDiagnosticLog} from './diagnostic-logs.ts';

/** Fill the opt-in diagnostic gap when a turn fails outside a persisted activity. */
export function recordUnclassifiedTurnFailure(storage:Pick<Storage,'getItem'|'setItem'>,enabled:boolean,stageFailureRecorded:boolean,error:unknown):boolean{
 if(!enabled||stageFailureRecorded)return false;
 const stopped=error instanceof Error&&error.message==='Stopped';
 const persistence=error instanceof ActivityPersistenceError;
 try{
  appendDiagnosticLog(storage,{tool:'dialogue.turn',status:stopped?'stopped':'failed',code:persistence?'persistence_failure':stopped?'stopped':'operation_failed',message:'The conversation turn did not complete.'});
  return true;
 }catch{return false;}
}
