import {listMemoryEntries,validateMemoryListArgs,type ToolHost} from '../tool-host.ts';
export const definition = Object.freeze({id:'memory.list',version:1,effect:'read',network:'none',inputSchema:{type:'object',required:[],additionalProperties:false,properties:{path:{type:'string',maxLength:500},offset:{type:'integer',minimum:0,maximum:1_000_000},limit:{type:'integer',minimum:1,maximum:25}}}});
export async function run(args:unknown,host:ToolHost){
 const input=validateMemoryListArgs(args);
 if(!host.list)throw new Error('Memory folder listing is unavailable');
 host.check();
 const result=await host.list(input.path,input.offset,input.limit,host.signal);
 host.check();
 return result;
}
export {listMemoryEntries};
