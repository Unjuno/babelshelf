// QA only: real inference through canonical prompt, budget and semantic validator.
// No knowledge store, schedule executor, network tool or write port is supplied.
import {TextEngineRouter} from '../../design/prototype/src/text-engine-router.ts';
import {createTextInference} from '../../design/prototype/src/text-inference.ts';
import {planDialogue} from '../../design/prototype/src/conversation.ts';
import {nativeOutputRequest} from '../../design/prototype/src/native-output-format.ts';

export async function checkNativeHarness(engine:any,notify:(item:any)=>void){
 const router=new TextEngineRouter(engine,()=>{throw Error('Optional worker must stay idle');},[],undefined,true);
 const load=await router.load('2B');const cases:any[]=[];
 const requests=[
  {name:'Search saved notes',question:'Find notes about the meeting.',accept:(p:any)=>p.action==='search'&&(!p.target||p.target==='knowledge')&&/meeting/i.test(p.query)},
  {name:'Arithmetic plan',question:'Calculate 7 * 8.',accept:(p:any)=>p.action==='calculate'&&p.query.replace(/\s/g,'')==='7*8'},
  {name:'New note proposal',question:'Save a new note: The workshop starts at 15:30.',accept:(p:any)=>p.action==='capture'&&!p.target&&/workshop/i.test(p.body??'')&&/15:30/.test(p.body??'')}
 ];
 for(const request of requests){
  const item:any={name:request.name,question:request.question,counts:[],generations:[],passed:false};cases.push(item);notify(item);
  const port=createTextInference(()=>({
   get manifest(){return router.manifest;},get loaded(){return router.loaded!;},assets:{},
   load:async()=>{throw Error('No acquisition in harness QA');},stop:()=>router.abort(),
   count:async(messages:any[],format:any)=>{const value=await router.call('count',{messages,format});item.counts.push({messages,format,transport:nativeOutputRequest(messages,format),...value});return value;},
   generate:async(messages:any[],maxTokens:any,format:any)=>{const value=await router.generate(messages,undefined,maxTokens,format);item.generations.push({maxTokens,format,...value});return value;}
  }));
  const timer=setTimeout(()=>router.abort(),90000),started=performance.now();
  try{item.plan=await planDialogue(port,request.question,{summary:'',refs:[],recent:[],turnCount:0});item.passed=request.accept(item.plan);}
  catch(error:any){item.error=error.message;item.diagnostic=error.diagnostic;}
  finally{clearTimeout(timer);item.elapsedMs=performance.now()-started;notify(item);}
  if(!router.loaded)break;
 }
 return {load,cases,passed:cases.length===requests.length&&cases.every(c=>c.passed)};
}
