import type {KnowledgeStore} from './knowledge-store.ts';

type Runtime=Awaited<ReturnType<KnowledgeStore['createSemanticSearchRuntime']>>;
let createRuntime:((modelId:string)=>Promise<Runtime>)|null=null;

/** The app registers its canonical KnowledgeStore without introducing a
 * runtime import from the submission boundary back into React hooks. */
export function configureSemanticSearchRuntime(create:(modelId:string)=>Promise<Runtime>){createRuntime=create;}

/** Share one optional Search Worker between Settings and the agent turn. */
export function createSemanticSearchSession(create:()=>Promise<Runtime>){
 let runtime:Promise<Runtime>|null=null;
 return {
  get(){return runtime??=create().catch(error=>{runtime=null;throw error;});},
  async close(){const current=runtime;runtime=null;if(current)await(await current).close();},
 };
}

let session:ReturnType<typeof createSemanticSearchSession>|null=null,activeModelId='',switching:Promise<void>=Promise.resolve();
export async function getSemanticSearchRuntime(modelId:string){
 if(!createRuntime)throw Error('Search runtime is unavailable');
 if(activeModelId!==modelId){activeModelId=modelId;const target=modelId;switching=switching.then(async()=>{if(activeModelId!==target)return;const previous=session;session=null;await previous?.close();if(activeModelId===target)session=createSemanticSearchSession(()=>createRuntime!(target));});}
 await switching;
 if(activeModelId!==modelId)return getSemanticSearchRuntime(activeModelId);
 if(!session)session=createSemanticSearchSession(()=>createRuntime!(modelId));
 return session.get();
}
export async function closeSemanticSearchRuntime(){activeModelId='';switching=switching.then(async()=>{const previous=session;session=null;await previous?.close();});await switching;}
