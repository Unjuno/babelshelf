export type DiagnosticLog={schema:1;id:string;at:string;tool:string;status:'failed'|'stopped';code:string;message:string};
const storageKey='babelshelf.diagnostic-logs.v1',limit=100,messageLimit=240;
const safeText=(value:unknown)=>String(value??'').replace(/[\r\n\t]+/g,' ').replace(/https?:\/\/\S+/gi,'[url]').replace(/[A-Za-z]:\\[^ ]+/g,'[path]').replace(/\b(?:[\w.+-]+)@[\w.-]+\.[A-Za-z]{2,}\b/g,'[email]').slice(0,messageLimit);
export function validateDiagnosticLogs(value:unknown):asserts value is DiagnosticLog[]{
 if(!Array.isArray(value)||value.length>limit)throw Error('Diagnostic log limit');const ids=new Set<string>();
 for(const item of value){if(!item||item.schema!==1||typeof item.id!=='string'||!item.id||ids.has(item.id)||typeof item.at!=='string'||!Number.isFinite(Date.parse(item.at))||typeof item.tool!=='string'||item.tool.length>80||!['failed','stopped'].includes(item.status)||typeof item.code!=='string'||item.code.length>60||typeof item.message!=='string'||item.message.length>messageLimit)throw Error('Invalid diagnostic log');ids.add(item.id);}
}
export function readDiagnosticLogs(storage:Pick<Storage,'getItem'>):DiagnosticLog[]{const raw=storage.getItem(storageKey);if(!raw)return [];const value=JSON.parse(raw);validateDiagnosticLogs(value);return value;}
export function writeDiagnosticLogs(storage:Pick<Storage,'setItem'>,logs:DiagnosticLog[]){const bounded=logs.slice(-limit);validateDiagnosticLogs(bounded);storage.setItem(storageKey,JSON.stringify(bounded));}
export function appendDiagnosticLog(storage:Pick<Storage,'getItem'|'setItem'>,event:{tool:string;status:'failed'|'stopped';code:string;message:string},id=crypto.randomUUID(),at=new Date().toISOString()){
 const logs=readDiagnosticLogs(storage),entry:DiagnosticLog={schema:1,id,at,tool:safeText(event.tool),status:event.status,code:safeText(event.code),message:safeText(event.message)};writeDiagnosticLogs(storage,[...logs,entry]);return entry;
}
export function clearDiagnosticLogs(storage:Pick<Storage,'removeItem'>){storage.removeItem(storageKey);}
