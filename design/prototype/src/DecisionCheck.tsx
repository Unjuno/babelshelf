import {useState} from 'react';
import {useDecision} from './useDecision';
import {decisionManifest} from './decision-assets';
import {decisionRoutingQuestion as question} from './decision-routing';
export default function DecisionCheck(){
 const engine=useDecision(decisionManifest.id),[state,setState]=useState('What is the reserve water amount in my saved notes?'),[result,setResult]=useState('');
 async function run(){setResult('');try{setResult(JSON.stringify(await engine.classify(state,question),null,2));}catch(e){setResult((e as Error).message);}}
 return <main style={{padding:24,color:'#111',background:'#fff',fontSize:18,minHeight:'100dvh'}}><h1>Local decision diagnostic</h1><p>Prepared text graph only. No downloads, knowledge writes or cloud processing.</p><div>{decisionManifest.id} · {engine.ready?'Verified':'Not prepared'} · {engine.loaded?'Loaded':'Unloaded'} · {engine.progress}</div><label>State<textarea aria-label="Decision state" style={{display:'block',width:'100%',minHeight:100,fontSize:18}} value={state} onChange={e=>setState(e.target.value)}/></label><div style={{display:'flex',gap:12,flexWrap:'wrap',marginTop:16}}><button disabled={engine.busy||engine.loaded} onClick={()=>void engine.load().catch(e=>setResult(e.message))}>Load decision model</button><button disabled={!engine.loaded||engine.busy} onClick={()=>void run()}>Run local decision</button><button disabled={!engine.loaded||engine.busy} onClick={()=>void engine.unload().catch(e=>setResult(e.message))}>Unload decision model</button><button onClick={engine.stop}>Stop</button></div><pre style={{whiteSpace:'pre-wrap',fontSize:16}}>{result}</pre></main>;
}
