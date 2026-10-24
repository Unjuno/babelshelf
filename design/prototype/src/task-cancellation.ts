export type TaskCancellation={signal:AbortSignal;check:()=>void;stop:()=>boolean;claimCompletion:()=>boolean};

/** Bind user Stop to both the task's async guard and its active local inference. */
export function createTaskCancellation(stopInference:()=>void):TaskCancellation{
 const controller=new AbortController();
 let completionClaimed=false;
 return {
  signal:controller.signal,
  check(){if(controller.signal.aborted)throw Error('Stopped');},
  stop(){if(controller.signal.aborted||completionClaimed)return false;controller.abort();stopInference();return true;},
  claimCompletion(){if(controller.signal.aborted||completionClaimed)return false;completionClaimed=true;return true;},
 };
}
