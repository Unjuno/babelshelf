import { validateQuery, type ToolHost } from '../tool-host.ts';
const DEFAULT_LENGTH=2_000,MAX_AGENT_LENGTH=3_000,MAX_DIRECT_LENGTH=10_000_000;
export const definition = Object.freeze({id: 'memory.read', version: 3, effect: 'read', network: 'none', inputSchema: {type: 'object', required: ['query'], additionalProperties: false, properties: {query: {type: 'string', minLength: 1, maxLength: 2000},start:{type:'integer',minimum:0,maximum:10_000_000},length:{type:'integer',minimum:1,maximum:MAX_AGENT_LENGTH}}}});
export async function run(args: unknown, host: ToolHost) {
 if(!args||typeof args!=='object'||Array.isArray(args))throw Error('Invalid tool query');
 const input=args as Record<string,unknown>;
 if(Object.keys(input).some(key=>!['query','start','length'].includes(key)))throw Error('Invalid tool query');
 const query = validateQuery({query:input.query});
 const start=input.start??0,length=input.length??DEFAULT_LENGTH;
 if(!Number.isSafeInteger(start)||Number(start)<0||Number(start)>10_000_000||!Number.isSafeInteger(length)||Number(length)<1||Number(length)>MAX_DIRECT_LENGTH)throw Error('Invalid Memory range');
 host.check();
 const result = await host.resolve(query);
 host.check();
 return result.map(note=>{
  const text=note.body;
  // Offsets are UTF-16, but a range must not split a supplementary character.
  const insidePair=(offset:number)=>offset>0&&offset<text.length&&text.charCodeAt(offset-1)>=0xd800&&text.charCodeAt(offset-1)<=0xdbff&&text.charCodeAt(offset)>=0xdc00&&text.charCodeAt(offset)<=0xdfff;
  let actualStart=Math.min(Number(start),text.length);
  if(insidePair(actualStart))actualStart--;
  let end=Math.min(actualStart+Number(length),text.length);
  if(insidePair(end))end=end===actualStart+1?end+1:end-1;
  return {id:note.id,path:note.path,version:note.version,body:text.slice(actualStart,end),start:actualStart,totalChars:text.length};
 });
}
