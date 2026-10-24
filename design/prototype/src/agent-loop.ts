// The application owns tool availability, the step budget and cancellation.
// This loop only coordinates validated plans and trusted registered adapters.
export const MAX_AGENT_TOOL_CALLS=3;
export const MAX_AGENT_RESULT_CHARS=8_000;
export const SAFE_AGENT_TOOL_IDS=['memory.search','memory.read','math.calculate'] as const;

export type AgentToolCapability={id:string;readOnly:true;network:'none';usage?:string;inputSchema?:Readonly<Record<string,unknown>>};
export type AgentToolCall={kind:'tool';tool:string;arguments:Record<string,unknown>};
export type AgentPlan<Final> = AgentToolCall|{kind:'final';value:Final};
export type AgentToolResult={tool:string;arguments:Record<string,unknown>;result:unknown};
export type AgentToolAttempt=AgentToolResult&{error?:{code:'invalid_tool_input'}};

/** Only the trusted pre-execution schema check may issue this recoverable error. */
export class AgentToolInputError extends Error {
 readonly code='invalid_tool_input';
 constructor(){super('Tool arguments do not match the declared schema.');this.name='AgentToolInputError';}
}

/** Stable receipt category for a rejected or malformed model-selected tool plan. */
export class AgentProtocolError extends Error {
 readonly code='agent_protocol';
 constructor(message:string){super(message);this.name='AgentProtocolError';}
}

/** Stable receipt category for an exception raised while an approved adapter runs. */
export class AgentToolExecutionError extends Error {
 readonly code='tool_execution';
 constructor(tool:string,_cause:unknown){super('A registered local tool could not complete its operation.');this.name='AgentToolExecutionError';this.tool=tool;}
 readonly tool:string;
}

function exactKeys(value:Record<string,unknown>,expected:string[]){
 const actual=Object.keys(value).sort(),wanted=[...expected].sort();
 return actual.length===wanted.length&&actual.every((key,index)=>key===wanted[index]);
}
function validRecord(value:unknown):value is Record<string,unknown>{
 return !!value&&typeof value==='object'&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
}
function snapshotBoundedResult(result:unknown,maxChars=MAX_AGENT_RESULT_CHARS):unknown{
 let serialized:string;
 try{serialized=JSON.stringify(result);}catch{throw new AgentProtocolError('Tool result is not serializable');}
 if(typeof serialized!=='string')throw new AgentProtocolError('Tool result is not serializable');
 if(serialized.length>maxChars)throw new AgentProtocolError('Tool result too large for the active context');
 return JSON.parse(serialized);
}

/** Run at most three registered tools in sequence, then return the model's final plan.
 * Tool output is handed back as data; it must be labelled untrusted by the caller.
 */
export async function runReadOnlyAgentLoop<Final>(input:{
 allowedTools:readonly AgentToolCapability[];
 maxToolCalls?:number;
 maxResultChars?:number;
 plan:(history:readonly AgentToolAttempt[])=>Promise<AgentPlan<Final>>;
 execute:(call:AgentToolCall)=>Promise<unknown>;
 check:()=>void;
}):Promise<{final:Final;calls:readonly AgentToolResult[];attempts:readonly AgentToolAttempt[]}>{
 if(!Array.isArray(input.allowedTools)||new Set(input.allowedTools.map(tool=>tool.id)).size!==input.allowedTools.length||input.allowedTools.some(tool=>!tool||typeof tool.id!=='string'||!/^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/.test(tool.id)||tool.readOnly!==true||tool.network!=='none'))throw new AgentProtocolError('Invalid agent tool allowlist');
 const maxToolCalls=input.maxToolCalls??MAX_AGENT_TOOL_CALLS,maxResultChars=input.maxResultChars??MAX_AGENT_RESULT_CHARS;
 if(!Number.isSafeInteger(maxToolCalls)||maxToolCalls<0||maxToolCalls>MAX_AGENT_TOOL_CALLS||!Number.isSafeInteger(maxResultChars)||maxResultChars<256||maxResultChars>MAX_AGENT_RESULT_CHARS)throw new AgentProtocolError('Invalid agent profile budget');
 const allowed=new Set(input.allowedTools.map(tool=>tool.id)),history:AgentToolAttempt[]=[];
 for(let step=0;step<=MAX_AGENT_TOOL_CALLS;step++){
  input.check();
  // A planner must not be able to change evidence from an earlier step.
  const plan=await input.plan(structuredClone(history));
  input.check();
  if(!validRecord(plan)||typeof plan.kind!=='string')throw new AgentProtocolError('Invalid agent plan');
  if(plan.kind==='final'){
   if(!exactKeys(plan,['kind','value']))throw new AgentProtocolError('Invalid agent final plan');
   return {final:plan.value as Final,calls:history.filter(item=>!item.error),attempts:history};
  }
  if(plan.kind!=='tool'||!exactKeys(plan,['kind','tool','arguments'])||typeof plan.tool!=='string'||!allowed.has(plan.tool)||!validRecord(plan.arguments))throw new AgentProtocolError('Tool is not registered or call is invalid');
  if(step>=maxToolCalls)throw new AgentProtocolError('Agent tool call limit reached');
  const recordedArguments=structuredClone(plan.arguments);
  const call:AgentToolCall={kind:'tool',tool:plan.tool,arguments:structuredClone(recordedArguments)};
  input.check();
  let result:unknown;
  try{result=await input.execute(call);}catch(error){
   input.check();
   if(!(error instanceof AgentToolInputError))throw error;
   // A rejected attempt consumes the same budget, but is never source evidence.
   history.push({tool:plan.tool,arguments:recordedArguments,result:null,error:{code:'invalid_tool_input'}});
   continue;
  }
  input.check();
  history.push({tool:call.tool,arguments:recordedArguments,result:snapshotBoundedResult(result,maxResultChars)});
 }
 throw new AgentProtocolError('Agent tool call limit reached');
}
