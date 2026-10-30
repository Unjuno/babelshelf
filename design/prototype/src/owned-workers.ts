// Call only inside the dedicated runtime worker, before loading an engine.
export function ownChildWorkers(scope:{Worker:typeof Worker}){
 if(typeof document!=='undefined')throw Error('Dedicated worker scope required');
 const Base=scope.Worker,children=new Set<Worker>();let disposed=false;
 class OwnedWorker extends Base{
  constructor(url:string|URL,options?:WorkerOptions){if(disposed)throw Error('Stopped');super(url,options);children.add(this);}
  terminate(){children.delete(this);super.terminate();}
 }
 scope.Worker=OwnedWorker;
 return {get size(){return children.size;},dispose(){
  disposed=true;let failed=false,firstError:unknown;
  for(const worker of [...children])try{worker.terminate();}catch(error){if(!failed){failed=true;firstError=error;}}
  if(failed)throw firstError;
 }};
}
