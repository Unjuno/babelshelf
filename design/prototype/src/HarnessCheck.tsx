// Explicit local diagnostic route. Fixed INPUT fixtures; every output is real inference.
// Does not open the knowledge database, read conversations, download or write records.
import {useEffect,useRef,useState} from 'react';
import {parseHarnessCases,type HarnessFixture as Fixture} from './harness-fixtures';
// @ts-expect-error Shared baseline controller is JavaScript.
import {Engine} from '../../../dist/engine.js';
import manifest from '../../../dist/model-manifest.json';
import {dialogueAnswerMessages} from './grounded-answer';
import type {DialogueContext} from './conversation';
import {parseChatAnswer} from './conversation';

const code='CEDAR-4826',expected='CEDAR\n4826';
const request='直前の回答のコードを、ハイフンの前と後に分けて二行で返して。';
const direct='コード CEDAR-4826 をハイフンの前と後に分けて二行で返して。';
const recent:DialogueContext={summary:'',refs:[],turnCount:1,recent:[{id:'fixture',user:'この会話のコードは '+code+' です。',answer:code}]};
const read:DialogueContext={summary:'',refs:[],turnCount:1,recent:[],recalled:[{turnId:'fixture',turnIndex:0,speaker:'assistant',quote:code,start:0,end:code.length}]};
const summary:DialogueContext={summary:'The preceding assistant answer was '+code+'.',refs:[],turnCount:1,recent:[]};
const fixtures:Fixture[]=[
 {id:'raw-minimal',messages:[{role:'system',content:'Follow the last user request. Output only the requested result.'},{role:'user',content:direct}],json:false,reset:true},
 {id:'json-minimal',messages:[{role:'system',content:'Follow the last user request. Return ONLY JSON {"answer":"..."}.'},{role:'user',content:direct}],json:true,reset:false},
 {id:'direct-app',messages:dialogueAnswerMessages(direct),json:true,reset:false},
 {id:'recent-app',messages:dialogueAnswerMessages(request,recent),json:true,reset:false},
 {id:'read-app',messages:dialogueAnswerMessages(request,read),json:true,reset:false},
 {id:'summary-app',messages:dialogueAnswerMessages(request,summary),json:true,reset:false},
 {id:'read-reset',messages:dialogueAnswerMessages(request,read),json:true,reset:true},
 {id:'read-English',messages:dialogueAnswerMessages('Split the code in the previous answer at the hyphen. Return the two parts on separate lines.',read),json:true,reset:true},
];
export default function HarnessCheck(){
 const engine=useRef<any>(null),cancelled=useRef(false),lock=useRef(false);
 const [ready,setReady]=useState(false),[running,setRunning]=useState(false),[status,setStatus]=useState('Checking local assets'),[results,setResults]=useState<any[]>([]),[cases,setCases]=useState(fixtures);
 useEffect(()=>{const e=new Engine(manifest,()=>{},new Worker(new URL('./bonsai-worker.ts',import.meta.url),{type:'module'}));engine.current=e;e.init().then((assets:any)=>{setReady(!!assets['4B']?.filesPresent);setStatus(assets['4B']?.filesPresent?'Local 4B available':'Not prepared · use Settings');}).catch((error:Error)=>setStatus(error.message));return()=>{e.abort();e.worker.terminate();};},[]);
 async function run(){if(lock.current||!ready)return;lock.current=true;cancelled.current=false;setRunning(true);setResults([]);
  try{const e=engine.current;if(e.loaded!=='4B')await e.load('4B',(_type:string,value:string)=>setStatus(String(value)));for(const fixture of cases){if(cancelled.current)break;setStatus(fixture.id);const maxTokens=fixture.maxTokens??256,count=await e.call('count',{messages:fixture.messages});if(count.prompt_tokens+maxTokens>manifest.contextTokens)throw Error('Fixture exceeds context');const raw=await e.call('generate',{messages:fixture.messages,maxTokens,resetSession:fixture.reset,profile:fixture.profile,seed:fixture.seed});if(cancelled.current||raw.stopped)break;let answer='',error='';try{answer=fixture.json?parseChatAnswer(raw.text,[],true).answer:raw.text;}catch(e){error=(e as Error).message;}const target=fixture.expected===null?null:fixture.expected??expected;setResults(previous=>[...previous,{id:fixture.id,resetSession:fixture.reset,profile:fixture.profile??'greedy',seed:fixture.seed,input:fixture.messages,count,maxTokens,expected:target,answer,error,pass:target===null?null:!error&&answer.trim()===target,raw}]);}setStatus(cancelled.current?'Stopped':'Completed');}
  catch(error){setStatus((error as Error).message);}finally{lock.current=false;setRunning(false);}
 }
 async function importCases(file?:File){if(!file||lock.current)return;try{if(file.size>150000)throw Error('Fixture file too large');const cases=parseHarnessCases(await file.text());setCases(cases);setStatus('Loaded '+cases.length+' cases');}catch(error){setStatus((error as Error).message);}}
 const report={schema:1,model:'4B',revision:manifest.models.find(m=>m.id==='4B')!.revision,runtime:manifest.runtime.revision,contextTokens:manifest.contextTokens,maxTokens:256,status,results};
 return <main style={{height:'100dvh',overflow:'auto',padding:24,background:'#fff',color:'#14251c'}}><h1>Local harness check</h1><p>Test inputs · actual Bonsai 4B · no knowledge records or downloads</p><label>Load cases <input aria-label="Load cases" type="file" accept=".json" disabled={running} onChange={e=>void importCases(e.target.files?.[0])}/></label><p><button disabled={!ready||running} onClick={()=>void run()}>Run comparison</button><button disabled={!running} onClick={()=>{cancelled.current=true;engine.current?.abort();}}>Stop</button></p><p role="status">{status}</p><table style={{borderSpacing:12,textAlign:'left'}}><thead><tr><th>Case</th><th>Result</th><th>Answer</th></tr></thead><tbody>{results.map(r=><tr key={r.id}><td>{r.id}</td><td>{r.pass===null?'Observed':r.pass?'PASS':'FAIL'}</td><td style={{whiteSpace:'pre-wrap'}}>{r.error||r.answer}</td></tr>)}</tbody></table><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',fontSize:16}}>{JSON.stringify(report,null,2)}</pre></main>;
}
