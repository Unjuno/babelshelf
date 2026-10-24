import type {MemorySearchResult,MemoryPassageResult} from '../memory-search-types.ts';
import {validateFileResults} from '../file-discovery.ts';
import type {ToolNote,ToolHost} from './tool-host.ts';
import type {createToolRegistry} from './tool-registry.ts';

export type CalculationToolResult={expression:string;result:number;precision:'IEEE-754 binary64'};
export type BuiltinToolResults={
 'memory.search':MemorySearchResult[];
 'memory.read':ToolNote[];
 'math.calculate':CalculationToolResult[];
};
export type BuiltinToolId=keyof BuiltinToolResults;
type ToolRunner=Pick<ReturnType<typeof createToolRegistry>,'run'>;

function record(value:unknown):value is Record<string,unknown>{return !!value&&typeof value==='object'&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);}
function exactKeys(value:Record<string,unknown>,keys:readonly string[]){const actual=Object.keys(value).sort(),expected=[...keys].sort();return actual.length===expected.length&&actual.every((key,index)=>key===expected[index]);}

function memorySearchResults(value:unknown):MemorySearchResult[]{
 if(!Array.isArray(value)||value.length>20)throw Error('Invalid Memory search result');
 const result:MemorySearchResult[]=[];
 for(const item of value){
  if(!record(item))throw Error('Invalid Memory search result');
  if(item.kind==='file'){
   validateFileResults([item]);result.push(item as MemorySearchResult);continue;
  }
  const keys=['noteId','revision','title','start','end','quote','score'];
  if(item.kind==='passage')keys.push('kind');
  if(item.groundingEligible!==undefined)keys.push('groundingEligible');
  if(!exactKeys(item,keys)||typeof item.noteId!=='string'||!item.noteId||item.noteId.length>160||!Number.isSafeInteger(item.revision)||Number(item.revision)<1||typeof item.title!=='string'||item.title.length>2048||!Number.isSafeInteger(item.start)||Number(item.start)<0||!Number.isSafeInteger(item.end)||Number(item.end)<=Number(item.start)||typeof item.quote!=='string'||!item.quote.length||item.quote.length>8000||Number(item.end)-Number(item.start)!==item.quote.length||typeof item.score!=='number'||!Number.isFinite(item.score)||item.score<=0||item.kind!==undefined&&item.kind!=='passage'||item.groundingEligible!==undefined&&typeof item.groundingEligible!=='boolean')throw Error('Invalid Memory passage result');
  result.push(item as unknown as MemoryPassageResult);
 }
 return result;
}

function memoryReadResults(value:unknown):ToolNote[]{
 if(!Array.isArray(value)||value.length>20||value.some(item=>!record(item)||!exactKeys(item,['id','path','version','body'])||typeof item.id!=='string'||!item.id||item.id.length>160||typeof item.path!=='string'||!item.path||item.path.length>1024||!Number.isSafeInteger(item.version)||Number(item.version)<1||typeof item.body!=='string'||item.body.length>10_000_000))throw Error('Invalid Memory read result');
 return value as ToolNote[];
}

function calculationResults(value:unknown):CalculationToolResult[]{
 if(!Array.isArray(value)||value.length!==1||!record(value[0])||!exactKeys(value[0],['expression','result','precision'])||typeof value[0].expression!=='string'||value[0].expression.length>200||typeof value[0].result!=='number'||!Number.isFinite(value[0].result)||value[0].precision!=='IEEE-754 binary64')throw Error('Invalid calculation result');
 return value as CalculationToolResult[];
}

/** Validate bundled tool output before UI code consumes its typed result. */
export async function runBuiltinTool<T extends BuiltinToolId>(registry:ToolRunner,id:T,args:unknown,host:ToolHost):Promise<BuiltinToolResults[T]>{
 const value=await registry.run(id,args,host);
 if(id==='memory.search')return memorySearchResults(value) as BuiltinToolResults[T];
 if(id==='memory.read')return memoryReadResults(value) as BuiltinToolResults[T];
 return calculationResults(value) as BuiltinToolResults[T];
}
