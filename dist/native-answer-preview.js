// Presentation only. Partial text is never a validated reply or a storage input.
export function nativeAnswerPreview(calls) {
 if(calls.size!==1)return '';
 const call=[...calls.values()][0];
 if(!['finish_answer','finish_summary','finish_capturetext'].includes(call.name))return '';
 const source=call.arguments;let i=0,answer='',seen=false;const eof=Symbol('incomplete');
 const ws=()=>{while(/\s/.test(source[i]??'')&&i<source.length)i++;};
 const need=()=>{if(i>=source.length)throw eof;};
 function string(capture=false){
  if(source[i++]!=='"')throw Error();let value='';
  for(;;){need();let c=source[i++];if(c==='"')return value;
   if(c==='\\'){need();c=source[i++];if(c==='u'){const hex=source.slice(i,i+4);if(!/^[0-9a-fA-F]{0,4}$/.test(hex))throw Error();if(hex.length<4)throw eof;c=String.fromCharCode(parseInt(hex,16));i+=4;}else{const escape={'"':'"','\\':'\\','/':'/','b':'\b','f':'\f','n':'\n','r':'\r','t':'\t'};if(!(c in escape))throw Error();c=escape[c];}}
   else if(c.charCodeAt(0)<32)throw Error();
   value+=c;if(capture)answer=value.replace(/[\uD800-\uDBFF]$/,'');
  }
 }
 function value(path,depth=0){
  if(depth>32)throw Error();ws();need();const c=source[i];
  if(c==='"'){const capture=path.length===2&&path[0]==='reply'&&path[1]==='answer';if(capture){if(seen)throw Error();seen=true;}string(capture);return;}
  if(c==='{'||c==='['){i++;const object=c==='{',end=object?'}':']',keys=new Set();ws();need();if(source[i]===end){i++;return;}for(;;){ws();need();let key='[]';if(object){key=string();if(keys.has(key))throw Error();keys.add(key);ws();need();if(source[i++]!==':')throw Error();}value([...path,key],depth+1);ws();need();if(source[i]===end){i++;return;}if(source[i++]!==',')throw Error();}}
  else{const start=i;while(i<source.length&&!/[\s,}\]]/.test(source[i]))i++;if(i===source.length)throw eof;JSON.parse(source.slice(start,i));}
 }
 try{value([]);ws();if(i!==source.length)return '';}catch(error){if(error!==eof)return '';}
 return answer;
}
