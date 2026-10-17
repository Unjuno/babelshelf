// Bounded JSON text for already validated plain data. Preserve JSON.stringify
// ordering, escaping and undefined handling without a full serialized string.
export function visitJsonChunks(value:unknown,visit:(text:string)=>void){
 const limit=65536,seen=new Set<object>();let pending='';
 function emit(text:string){
  pending+=text;
  while(pending.length>=limit){let end=limit;
   if(pending.charCodeAt(end-1)>=0xd800&&pending.charCodeAt(end-1)<=0xdbff&&pending.charCodeAt(end)>=0xdc00&&pending.charCodeAt(end)<=0xdfff)end--;
   visit(pending.slice(0,end));pending=pending.slice(end);
  }
 }
 function string(text:string){emit('"');for(let start=0;start<text.length;){let end=Math.min(text.length,start+8192);
  if(end<text.length&&text.charCodeAt(end-1)>=0xd800&&text.charCodeAt(end-1)<=0xdbff&&text.charCodeAt(end)>=0xdc00&&text.charCodeAt(end)<=0xdfff)end--;
  emit(JSON.stringify(text.slice(start,end)).slice(1,-1));start=end;
 }emit('"');}
 function walk(v:any){
  if(typeof v==='string'){string(v);return;}
  if(v===null||typeof v==='number'||typeof v==='boolean'){emit(JSON.stringify(v));return;}
  if(!v||typeof v!=='object')throw Error('Unsupported JSON value');
  if(seen.has(v))throw Error('Circular JSON value');seen.add(v);
  if(Array.isArray(v)){emit('[');for(let i=0;i<v.length;i++){if(i)emit(',');const item=v[i];walk(item===undefined||typeof item==='function'||typeof item==='symbol'?null:item);}emit(']');}
  else{const proto=Object.getPrototypeOf(v);if(proto!==null&&proto!==Object.prototype)throw Error('Unsupported JSON object');emit('{');let first=true;for(const key of Object.keys(v)){const item=v[key];if(item===undefined||typeof item==='function'||typeof item==='symbol')continue;if(!first)emit(',');first=false;string(key);emit(':');walk(item);}emit('}');}
  seen.delete(v);
 }
 walk(value);if(pending)visit(pending);
}
