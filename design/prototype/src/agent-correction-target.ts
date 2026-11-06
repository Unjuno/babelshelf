import type {AgentToolResult} from './agent-loop.ts';

type Request={action:string;query?:string;target?:string};
/** A successful built-in discovery may nominate a correction target, never
 * approve a write. The caller must re-read this exact canonical ID/version.
 * Custom-tool prose, invalid attempts and model-invented paths grant nothing. */
export function agentCorrectionTarget(request:Request,calls:readonly AgentToolResult[]):{noteId:string;revision:number}{
 if(request.action!=='edit'||request.target!=='path'||typeof request.query!=='string'||!request.query.trim())throw Error('Correction needs an exact discovered file');
 const pins=new Map<string,{noteId:string;revision:number}>();
 for(const call of calls){
  if((call as {error?:unknown}).error||!['memory.search','memory.read'].includes(call.tool))continue;
  const rows=Array.isArray(call.result)?call.result:call.tool==='memory.search'&&call.result&&typeof call.result==='object'&&Array.isArray((call.result as {hits?:unknown[]}).hits)?(call.result as {hits:unknown[]}).hits:[];
  for(const raw of rows){
   if(!raw||typeof raw!=='object'||Array.isArray(raw))continue;
   const row=raw as Record<string,unknown>,noteId=row.noteId,revision=row.revision,path=typeof row.path==='string'?row.path:row.title;
   if(typeof noteId!=='string'||!noteId||noteId.length>160||!Number.isSafeInteger(revision)||(revision as number)<1)continue;
   const matches=request.query===noteId||typeof path==='string'&&path.length<=1024&&(request.query===path||request.query===path.split('/').at(-1));
   if(matches)pins.set(noteId+'@'+revision,{noteId,revision:revision as number});
  }
 }
 if(pins.size!==1)throw Error(pins.size?'Ambiguous discovered file · choose an exact path':'File was not discovered · search again');
 return [...pins.values()][0];
}
