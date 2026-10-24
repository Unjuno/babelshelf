import {runBuiltinTool} from './tools/builtin-tool-results.ts';
import type {ToolHost} from './tools/tool-host.ts';
import type {createToolRegistry} from './tools/tool-registry.ts';

type CalculationRegistry=Pick<ReturnType<typeof createToolRegistry>,'identity'|'run'>;
type CalculationTrace=<T>(tool:'math.calculate',input:unknown,work:()=>Promise<T>)=>Promise<T>;

/** Keep explicit and planned arithmetic on the same registered, traced, typed local-tool path. */
export async function runCalculationAction(expression:string,registry:CalculationRegistry,host:ToolHost,trace:CalculationTrace){
 const identity=await registry.identity('math.calculate');
 return trace('math.calculate',{expression,...identity},()=>runBuiltinTool(registry,'math.calculate',{expression},host));
}
