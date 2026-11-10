import {validateQuery,type ToolHost} from '../tool-host.ts';

export const definition=Object.freeze({
 id:'web.search',version:1,effect:'external',network:'explicit-online',
 inputSchema:{type:'object',required:['query'],additionalProperties:false,properties:{query:{type:'string',minLength:1,maxLength:2000}}},
});

export async function run(args:unknown,host:ToolHost){
 if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).length!==1||!Object.hasOwn(args,'query'))throw Error('Invalid web search arguments');
 const query=validateQuery(args);
 host.check();
 if(!host.webSearch)throw Error('Web search is not available');
 const result=await host.webSearch(query,host.signal);
 host.check();
 return result;
}
