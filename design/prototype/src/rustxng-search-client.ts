export type RustXngRawContentStatus='ok'|'not_requested'|'too_large'|'fetch_failed'|'robots_blocked'|'extract_failed'|'render_failed'|'unknown';
export type RustXngSearchResult={title:string;url:string;snippet:string;engine?:string;rawContentStatus:RustXngRawContentStatus;pageText?:string};
export type RustXngSearchResponse={provider:'RustXNG';query:string;retrievedAt:string;results:RustXngSearchResult[]};

const MAX_RESPONSE_BYTES=96*1024;
const MAX_RESULTS=5;
const MAX_TITLE_CHARS=240;
const MAX_SNIPPET_CHARS=1200;
const MAX_PAGE_TEXT_BYTES=12_000;
const REQUEST_TIMEOUT_MS=12_000;

export class RustXngSearchError extends Error{
 readonly code:'offline'|'invalid_endpoint'|'unavailable'|'invalid_response';
 constructor(code:RustXngSearchError['code']){super(code==='offline'?'Web search is unavailable while Offline':code==='invalid_endpoint'?'Check the RustXNG address':'RustXNG search is unavailable');this.name='RustXngSearchError';this.code=code;}
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

function boundedText(value:unknown,max:number){
 if(typeof value!=='string')return '';
 return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
}

function safeResultUrl(value:unknown):string|undefined{
 if(typeof value!=='string'||value.length>4096)return;
 try{const url=new URL(value);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)return;return url.href;}catch{return;}
}

function rawContentStatus(value:unknown):RustXngRawContentStatus{
 return value==='ok'||value==='not_requested'||value==='too_large'||value==='fetch_failed'||value==='robots_blocked'||value==='extract_failed'||value==='render_failed'?value:'unknown';
}

function boundedPageText(value:unknown):string|undefined{
 if(typeof value!=='string'||!value.trim())return;
 const bytes=new TextEncoder().encode(value);
 return new TextDecoder().decode(bytes.subarray(0,MAX_PAGE_TEXT_BYTES)).trim()||undefined;
}

async function readBoundedBody(response:Response){
 const advertised=Number(response.headers.get('content-length'));
 if(Number.isFinite(advertised)&&advertised>MAX_RESPONSE_BYTES)throw new RustXngSearchError('invalid_response');
 if(!response.body)throw new RustXngSearchError('invalid_response');
 const reader=response.body.getReader(),chunks:Uint8Array[]=[];let total=0;
 try{
  for(;;){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>MAX_RESPONSE_BYTES){await reader.cancel();throw new RustXngSearchError('invalid_response');}chunks.push(value);}
 }finally{reader.releaseLock();}
 const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)) as unknown;}catch{throw new RustXngSearchError('invalid_response');}
}

/** Search through a user-configured RustXNG HTTP endpoint. Offline mode never sends a request. */
export async function searchRustXng(input:{endpoint:string;query:string;onlineMode:boolean;onlineSignal:boolean;signal?:AbortSignal;fetcher?:typeof fetch;now?:()=>Date;maxResults?:number}):Promise<RustXngSearchResponse>{
 if(!input.onlineMode||!input.onlineSignal)throw new RustXngSearchError('offline');
 if(typeof input.query!=='string'||!input.query.trim()||input.query.length>2000)throw new RustXngSearchError('invalid_response');
 const endpoint=validateRustXngEndpoint(input.endpoint),fetcher=input.fetcher??globalThis.fetch.bind(globalThis);
 const maxResults=input.maxResults??MAX_RESULTS;if(!Number.isSafeInteger(maxResults)||maxResults<1||maxResults>MAX_RESULTS)throw new RustXngSearchError('invalid_response');
 if(input.signal?.aborted)throw input.signal.reason??new DOMException('Aborted','AbortError');
 const controller=new AbortController(),abort=()=>controller.abort(input.signal?.reason??new DOMException('Aborted','AbortError'));
 input.signal?.addEventListener('abort',abort,{once:true});
 const timeout=setTimeout(()=>controller.abort(new DOMException('Timed out','TimeoutError')),REQUEST_TIMEOUT_MS);
 try{
  const target=new URL(endpoint.href.replace(/\/$/, '')+'/search');target.searchParams.set('q',input.query.trim());target.searchParams.set('format','json');target.searchParams.set('max_results',String(maxResults));target.searchParams.set('include_raw_content','1');
  const response=await fetcher(target,{method:'GET',signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store',redirect:'error',headers:{Accept:'application/json'}});
  // A caller may cancel even when the transport resolves despite its signal.
  if(controller.signal.aborted)throw new RustXngSearchError('unavailable');
  if(!response.ok)throw new RustXngSearchError('unavailable');
  const payload=await readBoundedBody(response);
  // Streams may also complete after cancellation; never publish stale results.
  if(controller.signal.aborted)throw new RustXngSearchError('unavailable');
  if(!payload||typeof payload!=='object'||Array.isArray(payload)||!Array.isArray((payload as Record<string,unknown>).results))throw new RustXngSearchError('invalid_response');
  const rows=(payload as {results:unknown[]}).results,result:RustXngSearchResult[]=[];
  for(const value of rows){
   if(result.length>=maxResults)break;
   if(!value||typeof value!=='object'||Array.isArray(value))continue;
   const row=value as Record<string,unknown>,url=safeResultUrl(row.url),title=boundedText(row.title,MAX_TITLE_CHARS);
   if(!url||!title)continue;
   const snippet=boundedText(row.content,MAX_SNIPPET_CHARS),engine=boundedText(row.engine,80);
   const rawStatus=rawContentStatus(row.raw_content_status),pageText=rawStatus==='ok'?boundedPageText(row.raw_content):undefined;
   result.push({title,url,snippet,rawContentStatus:rawStatus,...(pageText?{pageText}:{}),...(engine?{engine}:{})});
  }
  return {provider:'RustXNG',query:input.query.trim(),retrievedAt:(input.now?.()??new Date()).toISOString(),results:result};
 }catch(error){
  if(controller.signal.aborted)throw input.signal?.aborted?input.signal.reason??new DOMException('Aborted','AbortError'):new RustXngSearchError('unavailable');
  if(error instanceof RustXngSearchError)throw error;
  throw new RustXngSearchError('unavailable');
 }finally{clearTimeout(timeout);input.signal?.removeEventListener('abort',abort);}
}
