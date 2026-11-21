import {taskRunView,type RunAttemptReceipt,type RunData,type RunDiagnostic} from './task-records';

function readRun(body:string):RunData|undefined{
 try{return taskRunView({ui:{recordType:'execution'},revisions:[{version:1,body}]});}catch{return undefined;}
}

function elapsed(startedAt:string,finishedAt?:string){
 if(!finishedAt)return undefined;
 const start=Date.parse(startedAt),finish=Date.parse(finishedAt);
 if(!Number.isFinite(start)||!Number.isFinite(finish)||finish<start)return undefined;
 const seconds=Math.floor((finish-start)/1000);
 return seconds<60?`${seconds}s`:`${Math.floor(seconds/60)}m ${seconds%60}s`;
}

function metricSummary(metrics:RunDiagnostic['inference']){
 if(!metrics)return [] as string[];
 const rows:string[]=[];
 rows.push(`${metrics.measuredModelCalls} model call${metrics.measuredModelCalls===1?'':'s'}`);
 if(metrics.promptTokens!==undefined)rows.push(`${metrics.promptTokens.toLocaleString()} input tokens`);
 if(metrics.outputTokens!==undefined)rows.push(`${metrics.outputTokens.toLocaleString()} output tokens`);
 if(metrics.runtimeCachedTokens!==undefined)rows.push(`${metrics.runtimeCachedTokens.toLocaleString()} reused tokens`);
 if(metrics.runtimePrefillMs!==undefined)rows.push(`Input processing ${formatMs(metrics.runtimePrefillMs)}`);
 if(metrics.runtimeDecodeMs!==undefined)rows.push(`Text generation ${formatMs(metrics.runtimeDecodeMs)}`);
 else if(metrics.generationWallMs!==undefined)rows.push(`Generation ${formatMs(metrics.generationWallMs)}`);
 return rows;
}

function formatMs(value:number){
 if(!Number.isFinite(value))return 'Unknown duration';
 if(value<0)return '0ms';
 const seconds=Math.floor(value/1000),milliseconds=Math.round(value%1000);
 if(seconds>=60)return `${Math.floor(seconds/60)}m ${seconds%60}s`;
 return seconds?`${seconds}.${String(milliseconds).padStart(3,'0')}s`:`${milliseconds}ms`;
}

function stageLabel(stage:RunDiagnostic['stage']){
 return stage==='answer-validation'?'Answer check':stage==='model-acquisition'?'Model setup':'Answer generation';
}

function reasonLabel(reason:string){
 const labels:Record<string,string>={
  'verbatim-source-recovery':'The model repeated source text instead of producing a verifiable answer.',
  'answer-shape':'The answer format could not be verified.',
  'prompt-echo':'The model repeated the schedule prompt.',
  'Answer contains an internal source label':'The answer included an internal source label.',
  'Answer exposes internal implementation details':'The answer included internal application details.',
  'internal-source-label':'The answer included an internal source label.',
 };
 return labels[reason]??reason;
}

function AttemptDetails({attempt,title}:{attempt:RunAttemptReceipt;title:string}){
 const metrics=metricSummary(attempt.diagnostic?.inference);
 return <details className="schedule-run-attempt"><summary>{title} · {attempt.status}{attempt.error?` · ${attempt.error}`:''}</summary>
  {attempt.answer&&<div><strong>Answer</strong><div className="file-body">{attempt.answer}</div></div>}
  {attempt.diagnostic&&<div><strong>Check</strong><p>{stageLabel(attempt.diagnostic.stage)} · {reasonLabel(attempt.diagnostic.reason)}</p>{attempt.diagnostic.candidate!==undefined&&<><strong>Rejected draft</strong><div className="file-body">{attempt.diagnostic.candidate||'No candidate text was returned.'}</div></>}</div>}
  {metrics.length>0&&<p>{metrics.join(' · ')}</p>}
 </details>;
}

/** Present the canonical schedule execution record as a readable local report. */
export function ScheduleRunDetails({body}:{body:string}){
 const run=readRun(body);
 if(!run)return <div className="file-body">{body}</div>;
 const timing=elapsed(run.startedAt,run.finishedAt),metrics=metricSummary(run.diagnostic?.inference),model=run.model??run.diagnostic?.model;
 return <section className="schedule-run-details" aria-label="Schedule run details">
  <p><strong>{run.status==='succeeded'?'Completed':run.status==='failed'?'Failed':run.status==='stopped'?'Stopped':run.status==='running'?'Running':run.status}</strong> · Attempt {run.attempt}{timing?` · ${timing}`:''}</p>
  {model&&<p>Model · {model.id}{model.runtime?` · ${model.runtime}`:''}</p>}
  {run.error&&<p role={run.status==='failed'?'alert':'status'}>{run.error}</p>}
  {run.answer&&<div><strong>Answer</strong><div className="file-body">{run.answer}</div></div>}
  {run.diagnostic&&<div className="schedule-run-diagnostic"><strong>Why it did not complete</strong><p>{stageLabel(run.diagnostic.stage)} · {reasonLabel(run.diagnostic.reason)}</p>{run.diagnostic.candidate!==undefined&&<><strong>Rejected draft</strong><div className="file-body">{run.diagnostic.candidate||'No candidate text was returned.'}</div></>}</div>}
  {metrics.length>0&&<p aria-label="Model measurements">{metrics.join(' · ')}</p>}
  {(run.sources?.length??0)>0&&<p>{run.sources!.length} saved source reference{run.sources!.length===1?'':'s'}</p>}
  {run.attemptHistory?.map((attempt,index)=><AttemptDetails key={`${attempt.attempt}-${index}`} attempt={attempt} title={`Previous attempt ${attempt.attempt}`}/>)}
  <details className="schedule-run-technical-details"><summary>Technical record</summary><div className="file-body">{body}</div></details>
 </section>;
}
