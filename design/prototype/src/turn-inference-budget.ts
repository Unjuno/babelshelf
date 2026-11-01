import type {TextEngine} from './text-inference.ts';

export const MAX_TURN_GENERATION_TOKENS=131_072;
export const MAX_TURN_GENERATION_MS=3_600_000;
export class TurnInferenceBudgetError extends Error{
 readonly code='generation_budget_exhausted';
 readonly cause:'tokens'|'time';
 constructor(cause:'tokens'|'time'){
  super(cause==='tokens'?'Generation token budget reached':'Generation time budget reached');
  this.name='TurnInferenceBudgetError';this.cause=cause;
 }
}
export type TurnInferenceBudget={
 readonly generatedTokens:number;
 readonly generationMs:number;
 wrap(engine:TextEngine):TextEngine;
};
type BudgetTimers={set:(callback:()=>void,delay:number)=>unknown;clear:(handle:unknown)=>void};

/** Share one optional generation budget across every text-engine stage of a Send.
 * Null keeps the historical unlimited profile behavior. When a runtime omits
 * token usage, its requested output allowance is charged conservatively.
 */
export function createTurnInferenceBudget(options:{maxGenerationTokens:number|null;maxGenerationMs:number|null;now?:()=>number;timers?:BudgetTimers}):TurnInferenceBudget{
 const {maxGenerationTokens,maxGenerationMs}=options,now=options.now??(()=>performance.now());
 const timers=options.timers??{set:(callback:()=>void,delay:number)=>setTimeout(callback,delay),clear:(handle:unknown)=>clearTimeout(handle as ReturnType<typeof setTimeout>)};
 if(maxGenerationTokens!==null&&(!Number.isSafeInteger(maxGenerationTokens)||maxGenerationTokens<256||maxGenerationTokens>MAX_TURN_GENERATION_TOKENS)||maxGenerationMs!==null&&(!Number.isSafeInteger(maxGenerationMs)||maxGenerationMs<1_000||maxGenerationMs>MAX_TURN_GENERATION_MS))throw Error('Invalid generation budget');
 let generatedTokens=0,generationMs=0,timer:unknown,expired=false;
 const check=()=>{if(expired||maxGenerationMs!==null&&generationMs>=maxGenerationMs)throw new TurnInferenceBudgetError('time');if(maxGenerationTokens!==null&&generatedTokens>=maxGenerationTokens)throw new TurnInferenceBudgetError('tokens');};
 const checkCompleted=()=>{if(expired||maxGenerationMs!==null&&generationMs>maxGenerationMs)throw new TurnInferenceBudgetError('time');if(maxGenerationTokens!==null&&generatedTokens>maxGenerationTokens)throw new TurnInferenceBudgetError('tokens');};
 const budget:TurnInferenceBudget={
  get generatedTokens(){return generatedTokens;},get generationMs(){return generationMs;},
  wrap(engine){
   return new Proxy(engine,{get(target,key){
    if(key==='pin')return ()=>budget.wrap(target.pin?.()??target);
    if(key==='generate')return async(messages:any[],maxTokens=256,format?:Parameters<TextEngine['generate']>[2],onPreview?:Parameters<TextEngine['generate']>[3])=>{
    check();
    const remaining=maxGenerationTokens===null?maxTokens:Math.min(maxTokens,maxGenerationTokens-generatedTokens);
    if(!Number.isSafeInteger(remaining)||remaining<1)throw new TurnInferenceBudgetError('tokens');
    const started=now(),remainingMs=maxGenerationMs===null?undefined:maxGenerationMs-generationMs;
    if(remainingMs!==undefined&&remainingMs<=0)throw new TurnInferenceBudgetError('time');
    expired=false;let elapsedRecorded=false,tokensRecorded=false;
    if(remainingMs!==undefined)timer=timers.set(()=>{expired=true;try{(target as TextEngine&{stop?:()=>void}).stop?.();}catch{/* The generation rejection below remains authoritative. */}},remainingMs);
    try{
     const result=await target.generate(messages,remaining,format,onPreview?preview=>{if(!expired&&(remainingMs===undefined||now()-started<=remainingMs))onPreview(preview);}:undefined);
     generationMs+=Math.max(0,now()-started);elapsedRecorded=true;
     const used=result.outputTokens??remaining;if(!Number.isSafeInteger(used)||used<0)throw Error('Invalid generated token count');generatedTokens+=used;tokensRecorded=true;
     checkCompleted();return result;
    }catch(error){
     if(!elapsedRecorded)generationMs+=Math.max(0,now()-started);
     // A failed attempt still consumed compute. If token usage was not returned,
     // reserve the requested allowance so a retry cannot evade the cap.
     if(!tokensRecorded)generatedTokens+=remaining;
     if(expired)throw new TurnInferenceBudgetError('time');
     throw error;
    }finally{if(timer!==undefined){timers.clear(timer);timer=undefined;}}
    };
    const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
   }});
  },
 };
 return budget;
}
