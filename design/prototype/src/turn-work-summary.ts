import type {Activity} from './harness-activity.ts';
import {builtinToolIds} from './tools/builtin-tools.ts';

export type TurnWorkSummary={
 measuredModelCalls:number;
 promptTokens?:number;
 outputTokens?:number;
 tokenCountMs?:number;
 generationMs?:number;
 measuredToolCalls:number;
 toolElapsedMs?:number;
};

function finiteCounter(value:unknown):value is number{
 return typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=Number.MAX_SAFE_INTEGER;
}
function add(total:number|undefined,value:unknown,integer=false):number|undefined{
 if(!finiteCounter(value))return total;
 if(integer&&!Number.isSafeInteger(value))return total;
 const next=(total??0)+value;
 return Number.isFinite(next)&&next<=Number.MAX_SAFE_INTEGER?next:total;
}
function record(value:unknown):Record<string,unknown>|undefined{
 return !!value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:undefined;
}
function isAgentTool(tool:string){
 return builtinToolIds.includes(tool as typeof builtinToolIds[number])||tool==='tools.search'||tool==='tools.read-skill'||/^user\.[a-z][a-z0-9-]{0,47}$/.test(tool);
}

/** Read-only rollup of measured model and registered-tool work from turn receipts. */
export function summarizeTurnWork(activities:readonly Activity[]):TurnWorkSummary|null{
 let measuredModelCalls=0,promptTokens:number|undefined,outputTokens:number|undefined,tokenCountMs:number|undefined,generationMs:number|undefined,measuredToolCalls=0,toolElapsedMs:number|undefined;
 for(const activity of activities){
  if((activity.tool==='dialogue.plan'||activity.tool==='knowledge.answer')&&activity.status!=='running'){
   const inference=record(record(activity.output)?.inference);
   if(!inference)continue;
   const recordedCalls=inference.measuredModelCalls;
   const callCount=finiteCounter(recordedCalls)&&Number.isSafeInteger(recordedCalls)?recordedCalls:activity.status==='succeeded'?1:0;
   measuredModelCalls=add(measuredModelCalls,callCount,true)??measuredModelCalls;
   promptTokens=add(promptTokens,inference.promptTokens,true);
   outputTokens=add(outputTokens,inference.outputTokens,true);
   tokenCountMs=add(tokenCountMs,inference.countMs);
   generationMs=add(generationMs,inference.generationWallMs);
   continue;
  }
  if(!isAgentTool(activity.tool)||!activity.finishedAt)continue;
  const started=Date.parse(activity.startedAt),finished=Date.parse(activity.finishedAt),elapsed=finished-started;
  if(!Number.isFinite(elapsed)||elapsed<0||elapsed>Number.MAX_SAFE_INTEGER)continue;
  measuredToolCalls++;
  toolElapsedMs=add(toolElapsedMs,elapsed);
 }
 if(!measuredModelCalls&&!measuredToolCalls)return null;
 return {measuredModelCalls,...(promptTokens!==undefined?{promptTokens}:{}),...(outputTokens!==undefined?{outputTokens}:{}),...(tokenCountMs!==undefined?{tokenCountMs}:{}),...(generationMs!==undefined?{generationMs}:{}),measuredToolCalls,...(toolElapsedMs!==undefined?{toolElapsedMs}:{})};
}
