export type RustXngSearchErrorCode='offline'|'invalid_endpoint'|'unavailable'|'invalid_response';

export class RustXngSearchError extends Error{
 readonly code:RustXngSearchErrorCode;
 constructor(code:RustXngSearchErrorCode){super(code==='offline'?'Web search is unavailable while Offline':code==='invalid_endpoint'?'Check the RustXNG address':'RustXNG search is unavailable');this.name='RustXngSearchError';this.code=code;}
}

function isLoopback(host:string){
 const normalized=host.toLowerCase().replace(/^\[|\]$/g,'');
 // URL.hostname has already canonicalized numeric IPv4 spellings. A DNS
 // name beginning with 127. is not a loopback address.
 return normalized==='localhost'||normalized==='::1'||/^127(?:\.\d{1,3}){3}$/.test(normalized);
}

export function validateRustXngEndpoint(value:string):URL{
 if(typeof value!=='string'||!value.trim()||value.length>2048)throw new RustXngSearchError('invalid_endpoint');
 // Inspect an explicit HTTP(S) authority/path before URL normalization can
 // erase traversal or turn empty query/fragment markers into a broken target.
 const raw=value.trim(),parts=/^https?:\/\/[^/?#\\]+(\/[^?#\\]*)?$/i.exec(raw);
 if(!parts)throw new RustXngSearchError('invalid_endpoint');
 let endpoint:URL;try{endpoint=new URL(raw);}catch{throw new RustXngSearchError('invalid_endpoint');}
 const rawPath=parts[1]??'';
 const hasDotSegment=rawPath.split('/').some(part=>{try{const decoded=decodeURIComponent(part);return decoded==='.'||decoded==='..';}catch{return true;}});
 const localHttp=endpoint.protocol==='http:'&&isLoopback(endpoint.hostname);
 if((endpoint.protocol!=='https:'&&!localHttp)||endpoint.username||endpoint.password||endpoint.search||endpoint.hash||hasDotSegment||/[\u0000-\u0020]/.test(raw))throw new RustXngSearchError('invalid_endpoint');
 endpoint.pathname=endpoint.pathname.replace(/\/+$/,'');
 return endpoint;
}
