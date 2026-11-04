import {useEffect,useState} from 'react';

type Props={percent?:number;stage?:string;contextTokens?:number;isLfm3?:boolean};

function elapsedLabel(milliseconds:number){
 const seconds=Math.floor(milliseconds/1000),hours=Math.floor(seconds/3600),minutes=Math.floor(seconds%3600/60),remaining=seconds%60;
 return hours?`${hours}h ${String(minutes).padStart(2,'0')}m ${String(remaining).padStart(2,'0')}s`:minutes?`${minutes}m ${String(remaining).padStart(2,'0')}s`:`${remaining}s`;
}

/** Keep the once-per-second timer isolated so the full application does not rerender while a model initializes. */
function stageLabel(stage=''){
 if(/verif|check/i.test(stage))return 'Checking model file';
 if(/stream.*weight|reading.*weight/i.test(stage))return 'Reading model weights';
 if(/kernel|warmup|compile|context/i.test(stage))return 'Preparing model';
 if(/gpu/i.test(stage))return 'Starting GPU';
 return 'Loading model into memory';
}

function contextLabel(tokens:number){return tokens>=1024?`${tokens/1024}K`:`${tokens}`;}

export function ModelLoadFeedback({percent,stage,contextTokens,isLfm3=false}:Props){
 const [elapsedMs,setElapsedMs]=useState(0);
 useEffect(()=>{const started=Date.now(),tick=()=>setElapsedMs(Date.now()-started);tick();const timer=window.setInterval(tick,1000);return()=>window.clearInterval(timer);},[]);
 const elapsed=elapsedLabel(elapsedMs),takingLong=elapsedMs>=60_000,veryLong=elapsedMs>=300_000;
 const label=stageLabel(stage);
 return <div className="model-load-feedback">
  <div className="model-load-feedback-heading">
   <span>{percent===undefined?`${label} · progress not reported${veryLong?' · taking longer than expected':takingLong?' · still in progress':''}`:`${label} · ${percent}%`}</span>
   <time aria-label={`Elapsed ${elapsed}`} aria-live="off">{elapsed}</time>
  </div>
  <progress max={100} {...(percent===undefined?{}:{value:percent})} aria-label={percent===undefined?`${label}; runtime progress is unavailable`:`${label} ${percent}%`}/>
  {percent===undefined&&<span className="model-load-guidance">The model file is already saved. The runtime is loading it into memory and does not report an exact percentage. You can move to another BabelShelf screen; this load continues and its status stays visible.{isLfm3&&contextTokens&&contextTokens>8192?` ${contextLabel(contextTokens)} context is selected. Larger windows need more memory and may load more slowly; RAG retrieves relevant notes so routine questions can use a smaller window.`:''}{veryLong?' No load progress has been reported for over 5 minutes. You can stop and retry if you choose; the model file and notes stay saved. If retrying with a large LFM3 context, select 8K or 16K in Models to check whether context initialization is the cause.':takingLong?' The load is still running.':''}</span>}
 </div>;
}
