import {ModelPreparationRequired,type SubmissionOutcome} from './execution-result.ts';
export type SubmissionStage='saving'|'reading'|'planning'|'generating';
export type SubmissionPhase='idle'|'running'|'stopping'|'completed'|'awaitingApproval'|'cancelled'|'failed'|'blocked';
export type SubmissionState=Readonly<{phase:SubmissionPhase;id?:string;stage?:SubmissionStage;progress:string;reading:{id:string;label:string}|null;preview?:string;error?:string;outcome?:SubmissionOutcome}>;
export type SubmissionRun={id:string;signal:AbortSignal;check:()=>void;preview:(text:string)=>void;progress:(label:string,stage?:SubmissionStage,reading?:SubmissionState['reading'])=>void};
type Completion='completed'|'awaitingApproval'|'blocked';

/** Stable short fallback while a runtime has not reported detailed progress. */
export function submissionStageLabel(stage:SubmissionStage|undefined){
 return stage==='saving'?'Saving…':stage==='reading'?'Reading…':stage==='planning'?'Planning…':stage==='generating'?'Generating…':'';
}

/** Owns transient execution only. Storage receipts must be adopted before check(). */
export function createSubmissionController(){
 let state:SubmissionState=Object.freeze({phase:'idle',progress:'',reading:null});
 let owner:{id:string;abort:AbortController}|null=null;
 const observers=new Set<(state:SubmissionState)=>void>();
 const publish=(next:SubmissionState)=>{state=Object.freeze(next);for(const notify of observers)try{notify(state);}catch{/* A detached view cannot change an execution result. */}};
 return {
  get state(){return state;},get busy(){return owner!==null;},
  subscribe(notify:(state:SubmissionState)=>void){observers.add(notify);return ()=>{observers.delete(notify);};},
  stop(){if(!owner||owner.abort.signal.aborted)return false;owner.abort.abort();publish({...state,preview:'',phase:'stopping',progress:'Stopping…'});return true;},
  async run(work:(run:SubmissionRun)=>Promise<SubmissionOutcome|void>):Promise<Completion|'cancelled'|'failed'|'busy'>{
   if(owner)return 'busy';
   const own={id:crypto.randomUUID(),abort:new AbortController()};owner=own;
   const check=()=>{if(owner!==own||own.abort.signal.aborted)throw Error('Stopped');};
   const run:SubmissionRun={id:own.id,signal:own.abort.signal,check,preview:(text)=>{if(owner!==own||own.abort.signal.aborted)return;if(typeof text!=='string'||text.length>32768)throw Error('Invalid answer preview');publish({...state,preview:text});},progress:(label,stage,reading)=>{
    if(owner!==own||own.abort.signal.aborted)return;
    publish({...state,progress:label,...(stage?{stage}:{}),reading:reading??null});
   }};
   publish({id:own.id,phase:'running',stage:'saving',progress:'',reading:null,preview:''});
   let phase:Completion|'cancelled'|'failed',error:string|undefined,outcome:SubmissionOutcome|undefined;
   try{check();const result=await work(run);check();outcome=result??{kind:'displayed'};phase=outcome.kind==='awaitingApproval'?'awaitingApproval':outcome.kind==='needsPreparation'||outcome.kind==='needsInput'?'blocked':outcome.kind==='failed'?'failed':outcome.kind==='cancelled'?'cancelled':'completed';}
   catch(e){phase=own.abort.signal.aborted?'cancelled':e instanceof ModelPreparationRequired?'blocked':'failed';error=e instanceof Error?e.message:String(e);outcome=phase==='blocked'?{kind:'needsPreparation',reason:(e as ModelPreparationRequired).reason}:phase==='cancelled'?{kind:'cancelled'}:{kind:'failed'};}
   finally{owner=null;}
   publish({id:own.id,phase:phase!,progress:'',reading:null,preview:'',outcome,...(error?{error}:{})});return phase!;
  },
 };
}
