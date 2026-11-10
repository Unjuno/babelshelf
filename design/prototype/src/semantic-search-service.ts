import {bindSemanticHits,chunkSemanticText,rankSemanticVectors,type SemanticVectorRecord} from './semantic-search-core.ts';
import type {MemoryPassageResult} from './memory-search-types.ts';

export type SemanticSearchSource={id:string;state:'active'|'withdrawn';revision:number;title:string;body:string;path?:string;protected?:boolean;recordType?:string};
export type SemanticVectorStore={
 replaceNote:(modelRevision:string,noteId:string,revision:number,records:readonly SemanticVectorRecord[],signal?:AbortSignal)=>Promise<number>;
 list:(modelRevision:string)=>Promise<SemanticVectorRecord[]>;
 removeNote:(modelRevision:string,noteId:string)=>Promise<number>;
};
export type SemanticSearchOptions={modelRevision:string;store:SemanticVectorStore;embed:(texts:readonly string[],signal?:AbortSignal)=>Promise<readonly (readonly number[]|Float32Array)[]>;signal?:AbortSignal;progress?:(completed:number,total:number)=>void;batchSize?:number;maxChunks?:number};
const check=(signal?:AbortSignal)=>{if(signal?.aborted)throw Error('Stopped');};
const identity=(value:string)=>typeof value==='string'&&value.length>0&&value.length<=512&&!/[\u0000-\u001f\u007f]/.test(value);
function eligible(source:SemanticSearchSource){return source.state==='active'&&!source.protected&&!['execution','notification'].includes(source.recordType??'')&&!/^(?:Tools|Settings|Notifications)\/|^Schedule\/Runs\//i.test(source.path??'');}
function validateOptions(options:SemanticSearchOptions){
 if(!identity(options.modelRevision)||!options.store||typeof options.store.replaceNote!=='function'||typeof options.store.list!=='function'||typeof options.store.removeNote!=='function'||typeof options.embed!=='function'||!Number.isInteger(options.batchSize??8)||(options.batchSize??8)<1||(options.batchSize??8)>64||!Number.isInteger(options.maxChunks??10000)||(options.maxChunks??10000)<1||(options.maxChunks??10000)>10000)throw Error('Invalid semantic search options');
}
function checkedVectors(values:readonly (readonly number[]|Float32Array)[],expected:number){
 if(!Array.isArray(values)||values.length!==expected)throw Error('Embedding count mismatch');
 const records=values.map(vector=>{
  if((!Array.isArray(vector)&&!(vector instanceof Float32Array))||vector.length<1||vector.length>4096||Array.from(vector).some(value=>typeof value!=='number'||!Number.isFinite(value)))throw Error('Invalid embedding vector');
  return Float32Array.from(vector);
 });
 const dimensions=records[0]?.length;if(records.some(vector=>vector.length!==dimensions))throw Error('Embedding dimensions changed');
 return records;
}

/** Build revision-pinned derived vectors without writing to or revising canonical Memory. */
export async function indexSemanticSources(sources:readonly SemanticSearchSource[],options:SemanticSearchOptions){
 validateOptions(options);if(!Array.isArray(sources))throw Error('Invalid semantic sources');check(options.signal);
 const current=new Map<string,SemanticSearchSource>();
 for(const source of sources){if(!source||!identity(source.id)||!Number.isSafeInteger(source.revision)||source.revision<1||typeof source.title!=='string'||typeof source.body!=='string'||current.has(source.id))throw Error('Invalid semantic source');current.set(source.id,source);}
 const targets=[...current.values()].filter(eligible),planned=targets.map(source=>({source,chunks:chunkSemanticText({id:source.id,version:source.revision,title:source.title,path:source.path,body:source.body}).length}));
 const total=planned.reduce((count,item)=>count+item.chunks,0);if(total>(options.maxChunks??10000))throw Error('Semantic indexing work limit reached');
 let completed=0;options.progress?.(completed,total);
 for(const {source} of planned){
  const chunks=chunkSemanticText({id:source.id,version:source.revision,title:source.title,path:source.path,body:source.body});
  check(options.signal);const records:SemanticVectorRecord[]=[];
  for(let offset=0;offset<chunks.length;offset+=options.batchSize??8){
   check(options.signal);const batch=chunks.slice(offset,offset+(options.batchSize??8)),vectors=checkedVectors(await options.embed(batch.map(chunk=>chunk.text),options.signal),batch.length);check(options.signal);
   for(let i=0;i<batch.length;i++){const chunk=batch[i];records.push({modelRevision:options.modelRevision,noteId:source.id,revision:source.revision,start:chunk.start,end:chunk.end,vector:vectors[i]});}
   completed+=batch.length;options.progress?.(completed,total);
  }
  // Replace only after the complete note has embedded successfully. A failed
  // or interrupted note keeps its previous derived index intact.
  await options.store.replaceNote(options.modelRevision,source.id,source.revision,records,options.signal);check(options.signal);
 }
 const indexedIds=new Set(targets.map(source=>source.id));
 // Derived vectors for withdrawn/protected/system/deleted sources are removed;
 // no canonical note or revision is touched.
 const previous=await options.store.list(options.modelRevision);check(options.signal);
 for(const id of new Set(previous.map(record=>record.noteId)))if(!indexedIds.has(id)){check(options.signal);await options.store.removeNote(options.modelRevision,id);}
 return {sources:targets.length,chunks:total,modelRevision:options.modelRevision};
}

/** Query vectors are generated by the selected local adapter; hits are rebound to live canonical notes. */
export async function searchSemanticSources(query:string,readCurrentSources:()=>Promise<readonly SemanticSearchSource[]>,options:SemanticSearchOptions,{limit=12}:{limit?:number}={}):Promise<MemoryPassageResult[]>{
 validateOptions(options);if(typeof query!=='string'||!query.trim()||query.length>4096||typeof readCurrentSources!=='function'||!Number.isInteger(limit)||limit<1||limit>20)throw Error('Invalid semantic search query');check(options.signal);
 const records=await options.store.list(options.modelRevision);check(options.signal);if(records.length===0)return [];
 const vectors=checkedVectors(await options.embed([query.trim()],options.signal),1);check(options.signal);
 const sources=await readCurrentSources();check(options.signal);if(!Array.isArray(sources))throw Error('Invalid semantic search sources');
 const hits=rankSemanticVectors(vectors[0],records,options.modelRevision,{limit});
 const current=sources.filter(eligible).map(source=>({id:source.id,state:source.state,path:source.path,revisions:[{version:source.revision,title:source.title,body:source.body}]}));
 return bindSemanticHits(current,hits,{limit});
}
