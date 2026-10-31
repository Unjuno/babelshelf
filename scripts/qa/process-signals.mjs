/** Give local QA runners one chance to close Playwright and remove their own
 * temporary profile when interrupted with Ctrl+C or a graceful termination. */
export function connectQaProcessSignals(processLike=process,controller=new AbortController()){
 const listeners=new Map();
 for(const signal of ['SIGINT','SIGTERM']){
  const listener=()=>{if(!controller.signal.aborted)controller.abort(Error(`QA interrupted by ${signal}`));};
  listeners.set(signal,listener);processLike.on(signal,listener);
 }
 return {signal:controller.signal,dispose(){for(const [name,listener] of listeners)processLike.removeListener(name,listener);listeners.clear();}};
}
