import { validateQuery, type ToolHost } from '../tool-host.ts';
export const definition = Object.freeze({id: 'memory.search', version: 2, effect: 'read', network: 'none', inputSchema: {type: 'object', required: ['query'], additionalProperties: false, properties: {query: {type: 'string', minLength: 1, maxLength: 2000},offset:{type:'integer',minimum:0,maximum:10000},limit:{type:'integer',minimum:1,maximum:12},snapshot:{type:'string',minLength:64,maxLength:64}}}});
export async function run(args: unknown, host: ToolHost) {
 if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).some(key=>!['query','offset','limit','snapshot'].includes(key)))throw Error('Invalid tool arguments');
 const input=args as Record<string,unknown>,query=validateQuery({query:input.query});
 const paged=Object.hasOwn(input,'offset');
 if(!paged&&(input.limit!==undefined||input.snapshot!==undefined))throw Error('Search offset required');
 if(paged&&(!Number.isSafeInteger(input.offset)||Number(input.offset)<0||Number(input.offset)>10000||input.limit!==undefined&&(!Number.isSafeInteger(input.limit)||Number(input.limit)<1||Number(input.limit)>12)||input.snapshot!==undefined&&(typeof input.snapshot!=='string'||!/^[a-f0-9]{64}$/.test(input.snapshot))))throw Error('Invalid search page');
 host.check();
 if(paged&&!host.searchPage)throw Error('Paged search unavailable');
 const result = paged?await host.searchPage!(query,{offset:Number(input.offset),limit:Number(input.limit??12),...(typeof input.snapshot==='string'?{snapshot:input.snapshot}:{})},host.signal):await host.search(query,host.signal);
 host.check();
 return result;
}
