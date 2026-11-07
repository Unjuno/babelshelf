export type TaskCancellation={signal:AbortSignal;check:()=>void;stop:()=>boolean;claimCompletion:()=>boolean};

/** Bind user Stop to both the task's async guard and its active local inference. */
export function createTaskCancellation(stopInference:()=>void|Promise<void>):TaskCancellation{
 const controller=new AbortController();
 let completionClaimed=false;
 return {
  signal:controller.signal,
  check(){if(controller.signal.aborted)throw Error('Stopped');},
  stop(){if(controller.signal.aborted||completionClaimed)return false;controller.abort();
   // Inference shutdown may be asynchronous; its rejection must not escape as
   // an unhandled promise after Stop already cancelled the task's signal.
   void Promise.resolve(stopInference()).catch(()=>{});
   return true;},
  claimCompletion(){if(controller.signal.aborted||completionClaimed)return false;completionClaimed=true;return true;},
 };
}
