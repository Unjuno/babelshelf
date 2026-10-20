// QA only: real inference through canonical prompt, budget and semantic validator.
// No knowledge store, schedule executor, network tool or write port is supplied.
import {TextEngineRouter} from '../../design/prototype/src/text-engine-router.ts';
import {createTextInference} from '../../design/prototype/src/text-inference.ts';
import {planDialogue,emptyDialogue,appendTurn,dialogueContext,resolveDialogueTarget} from '../../design/prototype/src/conversation.ts';
import {bindWorkingFileRequest,bindExplicitCurrentFileQuestion} from '../../design/prototype/src/working-file.ts';
import {nativeOutputRequest} from '../../design/prototype/src/native-output-format.ts';

export async function checkNativeHarness(engine:any,notify:(item:any)=>void,suite='basic'){
 if(!['basic','scoped','file','history'].includes(suite))throw Error('Unknown harness suite');
 const history=appendTurn(appendTurn(emptyDialogue(),{id:'qa-first',user:'Give a short marker.',answer:'Keep these original bytes: BLUE-42.'}),{id:'qa-last',user:'Give another marker.',answer:'A different latest answer: GREEN-53.'});
 const router=new TextEngineRouter(engine,()=>{throw Error('Optional worker must stay idle');},[],undefined,true);
 const load=await router.load('2B');const cases:any[]=[];
 const requests:any[]=suite!=='basic'?[
  {name:'Japanese new note',question:'新しいメモとして保存して：会議は月曜の10時から。',accept:(p:any)=>p.action==='capture'&&!p.target&&p.body==='会議は月曜の10時から。'},
  {name:'Opened file summary scope',question:'Summarize this file.',context:{summary:'',refs:[],recent:[],turnCount:0,currentFile:{noteId:'qa-opened-file',revision:3}},accept:(p:any)=>p.action==='summary'&&p.target==='file'},
  {name:'Save first assistant original',question:'Save your FIRST answer as a new note.',context:dialogueContext(history),accept:(p:any)=>p.action==='capture'&&p.target==='history'&&p.historyIndex===0&&p.historyPart==='assistant',resolve:(p:any)=>resolveDialogueTarget(history,p)}
 ]:[
  {name:'Search saved notes',question:'Find notes about the meeting.',accept:(p:any)=>p.action==='search'&&(!p.target||p.target==='knowledge')&&/meeting/i.test(p.query)},
  {name:'Arithmetic plan',question:'Calculate 7 * 8.',accept:(p:any)=>p.action==='calculate'&&p.query.replace(/\s/g,'')==='7*8'},
  {name:'New note proposal',question:'Save a new note: The workshop starts at 15:30.',accept:(p:any)=>p.action==='capture'&&!p.target&&/workshop/i.test(p.body??'')&&/15:30/.test(p.body??'')}
 ];
 const selected=suite==='file'?requests.filter(request=>request.name==='Opened file summary scope'):suite==='history'?requests.filter(request=>request.name==='Save first assistant original'):requests;
 for(const request of selected){
  const item:any={name:request.name,question:request.question,context:request.context??{summary:'',refs:[],recent:[],turnCount:0},counts:[],generations:[],passed:false};cases.push(item);notify(item);
  const port=createTextInference(()=>({
   get manifest(){return router.manifest;},get loaded(){return router.loaded!;},assets:{},
   load:async()=>{throw Error('No acquisition in harness QA');},stop:()=>router.abort(),
   count:async(messages:any[],format:any)=>{const value=await router.call('count',{messages,format});item.counts.push({messages,format,transport:nativeOutputRequest(messages,format),...value});return value;},
   generate:async(messages:any[],maxTokens:any,format:any)=>{const value=await router.generate(messages,undefined,maxTokens,format);item.generations.push({maxTokens,format,...value});return value;}
  }));
  const timer=setTimeout(()=>router.abort(),90000),started=performance.now();
  try{item.plan=await planDialogue(port,request.question,item.context);let resolved=item.plan;if(item.context.currentFile){resolved=bindExplicitCurrentFileQuestion(resolved,request.question,item.context.currentFile);resolved=bindWorkingFileRequest(resolved,item.context.currentFile).request;}item.resolvedPlan=resolved;item.passed=request.accept(resolved);if(item.passed&&request.resolve){item.original=request.resolve(resolved);item.passed=item.original.turnId==='qa-first'&&item.original.speaker==='assistant'&&item.original.quote==='Keep these original bytes: BLUE-42.';}}
  catch(error:any){item.error=error.message;item.diagnostic=error.diagnostic;}
  finally{clearTimeout(timer);item.elapsedMs=performance.now()-started;notify(item);}
  if(!router.loaded)break;
 }
 return {suite,load,cases,passed:cases.length===selected.length&&cases.every(c=>c.passed)};
}
