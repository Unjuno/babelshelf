import {useEffect,useState} from 'react';

type Props={percent?:number;stage?:string};

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

export function ModelLoadFeedback({percent,stage}:Props){
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
  {percent===undefined&&<span className="model-load-guidance">The model file is already saved. The runtime is loading it into memory and does not report an exact percentage.{veryLong?' You can stop and retry; the saved model file and your notes stay in place.':takingLong?' Keep BabelShelf open, or stop and retry.':''}</span>}
 </div>;
}
