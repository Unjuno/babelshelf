import {useEffect,useState} from 'react';

type Props={percent?:number;stage?:string};

function elapsedLabel(milliseconds:number){
 const seconds=Math.floor(milliseconds/1000),hours=Math.floor(seconds/3600),minutes=Math.floor(seconds%3600/60),remaining=seconds%60;
 return hours?`${hours}h ${String(minutes).padStart(2,'0')}m ${String(remaining).padStart(2,'0')}s`:minutes?`${minutes}m ${String(remaining).padStart(2,'0')}s`:`${remaining}s`;
}

/** Keep the once-per-second timer isolated so the full application does not rerender while a model initializes. */
function stageLabel(stage=''){
 if(/verif|check/i.test(stage))return 'Checking model file';
 if(/stream.*weight/i.test(stage))return 'Reading model weights';
 if(/kernel|warmup|compile/i.test(stage))return 'Preparing model';
 return 'Loading model';
}

export function ModelLoadFeedback({percent,stage}:Props){
 const [elapsedMs,setElapsedMs]=useState(0);
 useEffect(()=>{const started=Date.now(),tick=()=>setElapsedMs(Date.now()-started);tick();const timer=window.setInterval(tick,1000);return()=>window.clearInterval(timer);},[]);
 const elapsed=elapsedLabel(elapsedMs),takingLong=elapsedMs>=60_000,veryLong=elapsedMs>=300_000;
 const label=stageLabel(stage);
 return <div className="model-load-feedback">
  <div className="model-load-feedback-heading">
   <span>{percent===undefined?`${label} · ${veryLong?'taking longer than expected · ':takingLong?'still in progress · ':''}% unavailable`:`${label} · ${percent}%`}</span>
   <time aria-label={`Elapsed ${elapsed}`} aria-live="off">{elapsed}</time>
  </div>
  <progress max={100} {...(percent===undefined?{}:{value:percent})} aria-label={percent===undefined?`${label}; runtime progress is unavailable`:`${label} ${percent}%`}/>
  {percent===undefined&&<span className="model-load-guidance">{veryLong?'This runtime does not report exact progress. Stop and retry if it appears stuck; your files and notes stay saved.':takingLong?'This runtime does not report exact progress. Keep BabelShelf open, or stop and retry.':'First load may take time. This runtime does not report exact progress.'}</span>}
 </div>;
}
