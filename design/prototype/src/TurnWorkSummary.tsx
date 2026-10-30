import type {Activity} from './harness-activity.ts';
import {summarizeTurnWork} from './turn-work-summary.ts';

function seconds(value:number){return `${(value/1000).toFixed(1)} s`;}

export default function TurnWorkSummary({activities}:{activities:readonly Activity[]}){
 const summary=summarizeTurnWork(activities);
 if(!summary)return null;
 return <section aria-label="Turn work summary" className="turn-work-summary">
  <div className="capability-row"><span>Agent model calls · recorded</span><span>{summary.measuredModelCalls}</span></div>
  {summary.promptTokens!==undefined&&<div className="capability-row"><span>Prompt tokens · observed</span><span>{summary.promptTokens.toLocaleString()}</span></div>}
  {summary.outputTokens!==undefined&&<div className="capability-row"><span>Generated tokens · observed</span><span>{summary.outputTokens.toLocaleString()}</span></div>}
  {summary.tokenCountMs!==undefined&&<div className="capability-row"><span>Token counting</span><span>{seconds(summary.tokenCountMs)}</span></div>}
  {summary.generationMs!==undefined&&<div className="capability-row"><span>Generation</span><span>{seconds(summary.generationMs)}</span></div>}
  {summary.measuredToolCalls>0&&<div className="capability-row"><span>Tool calls · receipt time</span><span>{summary.measuredToolCalls}{summary.toolElapsedMs!==undefined?` · ${seconds(summary.toolElapsedMs)}`:''}</span></div>}
 </section>;
}
