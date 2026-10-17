// UTF-8 accounting without allocating an encoded copy of the complete string.
export function utf8BytesWithin(text:string,limit:number):boolean {
 if(text.length>limit)return false;
 let bytes=0;
 for(let i=0;i<text.length;i++){
  const c=text.charCodeAt(i);
  if(c<128)bytes++;else if(c<2048)bytes+=2;
  else if(c>=0xd800&&c<=0xdbff&&i+1<text.length&&text.charCodeAt(i+1)>=0xdc00&&text.charCodeAt(i+1)<=0xdfff){bytes+=4;i++;}
  else bytes+=3; // TextEncoder replaces lone UTF-16 surrogates with U+FFFD.
  if(bytes>limit)return false;
 }
 return true;
}
// Keep a surrogate pair in the same chunk so encoding matches TextEncoder(text).
export function visitUtf8Chunks(text:string,visit:(bytes:Uint8Array)=>void){
 const encoder=new TextEncoder(),chunk=65536;
 for(let start=0;start<text.length;){let end=Math.min(text.length,start+chunk);
  if(end<text.length&&text.charCodeAt(end-1)>=0xd800&&text.charCodeAt(end-1)<=0xdbff&&text.charCodeAt(end)>=0xdc00&&text.charCodeAt(end)<=0xdfff)end--;
  visit(encoder.encode(text.slice(start,end)));start=end;
 }
}
