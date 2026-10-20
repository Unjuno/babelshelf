type ResidentModel={readonly loaded:string|boolean;readonly busy:boolean;unload:()=>Promise<unknown>};

// Reader entry may release idle inference owners, never interrupt active work.
// Prepared model assets and user selections are owned separately.
export async function releaseIdleInference(residents:readonly ResidentModel[],check:()=>void){
 check();if(residents.some(model=>model.busy))throw Error('Model busy');
 for(const model of residents){check();if(model.busy)throw Error('Model busy');if(model.loaded)await model.unload();check();}
}
