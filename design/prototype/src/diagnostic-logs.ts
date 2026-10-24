export type DiagnosticLog={schema:1;id:string;at:string;tool:string;status:'failed'|'stopped';code:string;message:string};
const storageKey='babelshelf.diagnostic-logs.v1',limit=100,messageLimit=240;
const knownCodes=new Set(['stopped','source_changed','context_limit','not_prepared','invalid_model_output','not_found','operation_failed','planner_protocol','agent_protocol','invalid_tool_input','tool_execution','model_runtime','persistence_failure']);
const safeMessages:Record<string,string>={
 stopped:'The operation was stopped.',
 source_changed:'The saved source changed during the operation.',
 context_limit:'The request exceeded the active context limit.',
 not_prepared:'A required local capability is not prepared.',
 invalid_model_output:'The local model output did not pass validation.',
 not_found:'A required local record or resource was unavailable.',
 operation_failed:'The local operation failed.',
 planner_protocol:'The planner response did not match the required action format.',
 agent_protocol:'The agent step exceeded the allowed tool protocol or budget.',
 invalid_tool_input:'Tool arguments did not match the declared schema; the tool did not run.',
 tool_execution:'A registered local tool could not complete its operation.',
 model_runtime:'The selected local inference runtime failed.',
 persistence_failure:'The local operation receipt could not be saved.',
};
const safeTool=(value:unknown)=>typeof value==='string'&&/^[a-z][a-z0-9._-]{0,79}$/.test(value)?value:'unknown-operation';
const safeCode=(value:unknown)=>typeof value==='string'&&knownCodes.has(value)?value:'operation_failed';
function privacySafeLog(item:DiagnosticLog):DiagnosticLog{
 const code=safeCode(item.code);
 return {...item,tool:safeTool(item.tool),code,message:safeMessages[code]};
}
export function validateDiagnosticLogs(value:unknown):asserts value is DiagnosticLog[]{
 if(!Array.isArray(value)||value.length>limit)throw Error('Diagnostic log limit');const ids=new Set<string>();
 for(const item of value){if(!item||item.schema!==1||typeof item.id!=='string'||!item.id||ids.has(item.id)||typeof item.at!=='string'||!Number.isFinite(Date.parse(item.at))||typeof item.tool!=='string'||item.tool.length>80||!['failed','stopped'].includes(item.status)||typeof item.code!=='string'||item.code.length>60||typeof item.message!=='string'||item.message.length>messageLimit)throw Error('Invalid diagnostic log');ids.add(item.id);}
}
export function readDiagnosticLogs(storage:Pick<Storage,'getItem'>&Partial<Pick<Storage,'setItem'>>):DiagnosticLog[]{const raw=storage.getItem(storageKey);if(!raw)return [];const value=JSON.parse(raw);validateDiagnosticLogs(value);const safe=value.map(privacySafeLog);if(storage.setItem&&JSON.stringify(safe)!==JSON.stringify(value))try{storage.setItem(storageKey,JSON.stringify(safe));}catch{/* Sanitized results are still safe to display/use if local migration cannot be persisted. */}return safe;}
export function writeDiagnosticLogs(storage:Pick<Storage,'setItem'>,logs:DiagnosticLog[]){const bounded=logs.slice(-limit).map(privacySafeLog);validateDiagnosticLogs(bounded);storage.setItem(storageKey,JSON.stringify(bounded));}
export function appendDiagnosticLog(storage:Pick<Storage,'getItem'|'setItem'>,event:{tool:string;status:'failed'|'stopped';code:string;message:string},id=crypto.randomUUID(),at=new Date().toISOString()){
 const logs=readDiagnosticLogs(storage),entry=privacySafeLog({schema:1,id,at,tool:event.tool,status:event.status,code:event.code,message:event.message});writeDiagnosticLogs(storage,[...logs,entry]);return entry;
}
export function clearDiagnosticLogs(storage:Pick<Storage,'removeItem'>){storage.removeItem(storageKey);}
