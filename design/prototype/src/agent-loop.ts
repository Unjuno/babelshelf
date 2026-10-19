// The application owns tool availability, the step budget and cancellation.
// This loop only coordinates validated plans and trusted registered adapters.
export const MAX_AGENT_TOOL_CALLS=3;
const MAX_AGENT_RESULT_CHARS=8_000;

export type AgentToolCapability={id:string;readOnly:true;network:'none';usage?:string};
export type AgentToolCall={kind:'tool';tool:string;arguments:Record<string,unknown>};
export type AgentPlan<Final> = AgentToolCall|{kind:'final';value:Final};
export type AgentToolResult={tool:string;arguments:Record<string,unknown>;result:unknown};

function exactKeys(value:Record<string,unknown>,expected:string[]){
 const actual=Object.keys(value).sort(),wanted=[...expected].sort();
 return actual.length===wanted.length&&actual.every((key,index)=>key===wanted[index]);
}
function validRecord(value:unknown):value is Record<string,unknown>{
 return !!value&&typeof value==='object'&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
}
function serializeBoundedResult(result:unknown){
 let serialized:string;
 try{serialized=JSON.stringify(result)??'null';}catch{throw Error('Tool result is not serializable');}
 if(serialized.length>MAX_AGENT_RESULT_CHARS)throw Error('Tool result too large for the active context');
 return serialized;
}

/** Run at most three registered tools in sequence, then return the model's final plan.
 * Tool output is handed back as data; it must be labelled untrusted by the caller.
 */
export async function runReadOnlyAgentLoop<Final>(input:{
 allowedTools:readonly AgentToolCapability[];
 plan:(history:readonly AgentToolResult[])=>Promise<AgentPlan<Final>>;
 execute:(call:AgentToolCall)=>Promise<unknown>;
 check:()=>void;
}):Promise<{final:Final;calls:readonly AgentToolResult[]}>{
 if(!Array.isArray(input.allowedTools)||new Set(input.allowedTools.map(tool=>tool.id)).size!==input.allowedTools.length||input.allowedTools.some(tool=>!tool||typeof tool.id!=='string'||!/^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/.test(tool.id)||tool.readOnly!==true||tool.network!=='none'))throw Error('Invalid agent tool allowlist');
 const allowed=new Set(input.allowedTools.map(tool=>tool.id)),history:AgentToolResult[]=[];
 for(let step=0;step<=MAX_AGENT_TOOL_CALLS;step++){
  input.check();
  const plan=await input.plan(history);
  input.check();
  if(!validRecord(plan)||typeof plan.kind!=='string')throw Error('Invalid agent plan');
  if(plan.kind==='final'){
   if(!exactKeys(plan,['kind','value']))throw Error('Invalid agent final plan');
   return {final:plan.value as Final,calls:history};
  }
  if(plan.kind!=='tool'||!exactKeys(plan,['kind','tool','arguments'])||typeof plan.tool!=='string'||!allowed.has(plan.tool)||!validRecord(plan.arguments))throw Error('Tool is not registered or call is invalid');
  if(step===MAX_AGENT_TOOL_CALLS)throw Error('Agent tool call limit reached');
  const call:AgentToolCall={kind:'tool',tool:plan.tool,arguments:plan.arguments};
  input.check();
  const result=await input.execute(call);
  input.check();
  serializeBoundedResult(result);
  history.push({tool:call.tool,arguments:call.arguments,result});
 }
 throw Error('Agent tool call limit reached');
}
