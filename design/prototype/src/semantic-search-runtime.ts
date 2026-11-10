import {createSemanticEmbeddingBackend} from './semantic-embedding-backend.ts';
import {createSemanticIndexStore} from './semantic-index-store.ts';
import {indexSemanticSources,searchSemanticSources,type SemanticSearchSource} from './semantic-search-service.ts';
import {semanticEmbeddingManifest} from './semantic-embedding-manifest.ts';
import {runSemanticSearchSmoke} from './semantic-search-smoke.ts';

type KnowledgeReader={views:(signal?:AbortSignal)=>Promise<Array<{id:string;path:string;body:string;version:number;protected?:boolean;recordType?:string}>>};
type Events=(type:string,value:unknown)=>void;
const modelRevision=[semanticEmbeddingManifest.id,semanticEmbeddingManifest.revision,semanticEmbeddingManifest.runtime.revision,semanticEmbeddingManifest.dtype].join('@');

/** App-owned optional semantic path. Deterministic search remains the caller's fallback. */
export function createSemanticSearchRuntime(knowledge:KnowledgeReader,createWorker?:()=>Worker){
 const backend=createSemanticEmbeddingBackend(createWorker),store=createSemanticIndexStore();let closed=false;
 const check=()=>{if(closed)throw Error('Semantic Search runtime closed');};
 const sources=async(signal?:AbortSignal):Promise<SemanticSearchSource[]>=>{
  check();const views=await knowledge.views(signal);signal?.throwIfAborted();
  return views.map(note=>({id:note.id,state:'active',revision:note.version,title:note.path.split('/').at(-1)??note.path,body:note.body,path:note.path,protected:note.protected,recordType:note.recordType}));
 };
 const options=(signal?:AbortSignal,events?:Events)=>({modelRevision,store,signal,batchSize:4,maxChunks:10000,progress:(completed:number,total:number)=>events?.('index-progress',{completed,total}),embed:(texts:readonly string[],activeSignal?:AbortSignal)=>backend.embed(texts,activeSignal??signal,events)});
 return {
  modelRevision,
  get loaded(){return backend.loaded;},
  status:(signal?:AbortSignal)=>backend.status(signal),
  prepareRuntime:(allowNetwork:boolean,signal?:AbortSignal,events?:Events)=>backend.prepareRuntime(allowNetwork,signal,events),
  verifyRuntime:(signal?:AbortSignal,events?:Events)=>backend.verifyRuntime(signal,events),
  prepareModel:(allowNetwork:boolean,localFiles:File[]=[],signal?:AbortSignal,events?:Events)=>backend.prepare(allowNetwork,localFiles,signal,events),
  verifyModel:(signal?:AbortSignal,events?:Events)=>backend.verify(signal,events),
  async load(signal?:AbortSignal,events?:Events){check();return backend.load(signal,events);},
  async smokeTest(signal?:AbortSignal,events?:Events){check();if(!backend.loaded)throw Error('Load the Search model first');return runSemanticSearchSmoke((texts,activeSignal)=>backend.embed(texts,activeSignal??signal,events),signal);},
  async index(signal?:AbortSignal,events?:Events){check();if(!backend.loaded)throw Error('Prepare and load the Search model first');const current=await sources(signal);return indexSemanticSources(current,options(signal,events));},
  async search(query:string,limit=12,signal?:AbortSignal,events?:Events){check();if(!backend.loaded)throw Error('Prepare and load the Search model first');return searchSemanticSources(query,()=>sources(signal),options(signal,events),{limit});},
  async unload(signal?:AbortSignal){check();return backend.unload(signal);},
  async removeDerivedIndex(){check();await store.removeModel(modelRevision);},
  async close(){if(closed)return;closed=true;backend.close();await store.close();},
 };
}
