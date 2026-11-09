import type {KnowledgeStore} from './knowledge-store.ts';

type Runtime=Awaited<ReturnType<KnowledgeStore['createSemanticSearchRuntime']>>;
let createRuntime:(()=>Promise<Runtime>)|null=null;

/** The app registers its canonical KnowledgeStore without introducing a
 * runtime import from the submission boundary back into React hooks. */
export function configureSemanticSearchRuntime(create:()=>Promise<Runtime>){createRuntime=create;}

/** Share one optional Search Worker between Settings and the agent turn. */
export function createSemanticSearchSession(create:()=>Promise<Runtime>){
 let runtime:Promise<Runtime>|null=null;
 return {
  get(){return runtime??=create().catch(error=>{runtime=null;throw error;});},
  async close(){const current=runtime;runtime=null;if(current)await(await current).close();},
 };
}

let session:ReturnType<typeof createSemanticSearchSession>|null=null;
function activeSession(){if(!createRuntime)throw Error('Search runtime is unavailable');return session??=createSemanticSearchSession(createRuntime);}
export const getSemanticSearchRuntime=()=>activeSession().get();
export const closeSemanticSearchRuntime=()=>session?.close();
