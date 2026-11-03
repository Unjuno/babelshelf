import type {Activity} from './harness-activity.ts';
import {summarizeTurnWork} from './turn-work-summary.ts';

function duration(value:number){return value<1000?`${Math.round(value)} ms`:`${(value/1000).toFixed(1)} s`;}

export default function TurnWorkSummary({activities}:{activities:readonly Activity[]}){
 const summary=summarizeTurnWork(activities);
 if(!summary)return null;
 return <section aria-label="Turn work summary" className="turn-work-summary">
  <p className="source-revision">Recorded phases only · not total turn time</p>
  <div className="capability-row"><span>Text model calls · recorded</span><span>{summary.measuredModelCalls}</span></div>
  {summary.decisionChecks>0&&<div className="capability-row"><span>Decision checks · receipt time</span><span>{summary.decisionChecks}{summary.decisionElapsedMs!==undefined?` · ${duration(summary.decisionElapsedMs)}`:''}</span></div>}
  {summary.promptTokens!==undefined&&<div className="capability-row"><span>Prompt tokens · observed</span><span>{summary.promptTokens.toLocaleString()}</span></div>}
  {summary.outputTokens!==undefined&&<div className="capability-row"><span>Generated tokens · observed</span><span>{summary.outputTokens.toLocaleString()}</span></div>}
  {summary.tokenCountMs!==undefined&&<div className="capability-row"><span>Token counting</span><span>{duration(summary.tokenCountMs)}</span></div>}
  {summary.generationMs!==undefined&&<div className="capability-row"><span>Text generation</span><span>{duration(summary.generationMs)}</span></div>}
  {summary.measuredToolCalls>0&&<div className="capability-row"><span>Tool calls · receipt time</span><span>{summary.measuredToolCalls}{summary.toolElapsedMs!==undefined?` · ${duration(summary.toolElapsedMs)}`:''}</span></div>}
 </section>;
}
