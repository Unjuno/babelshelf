import {createStructuredGrammar,type StructuredFormat} from './structured-grammar.ts';
// ByteLevel token pieces must stay bytes: decoding each token separately corrupts
// multibyte characters split across tokens. This adapter is intentionally explicit.
export function createStructuredTokenFilter(format:StructuredFormat,tokenizer:any,eos:number|number[]){
 const grammar=createStructuredGrammar(format),decoder=tokenizer.decoder?.byte_decoder,vocab=tokenizer.model?.vocab;
 if(!decoder||!Array.isArray(vocab))throw Error('Structured decoding tokenizer unsupported');
 const special=new Set<number>(tokenizer.all_special_ids??[]),eosIds=new Set(Array.isArray(eos)?eos:[eos]);
 if(!eosIds.size||[...eosIds].some(id=>!Number.isSafeInteger(id)||id<0||id>=vocab.length))throw Error('Structured decoding EOS unavailable');
 const pieces=vocab.map((text:any,id:number)=>{
  if(special.has(id)||eosIds.has(id)||typeof text!=='string'||!text.length)return null;
  // Transformers.js reverseDictionary preserves original numeric keys as strings.
  const bytes=[...text].map(c=>{const raw=decoder[c];return typeof raw==='string'&&/^\d{1,3}$/.test(raw)?Number(raw):raw;});return bytes.some(b=>!Number.isInteger(b)||b<0||b>255)?null:Uint8Array.from(bytes);
 });
 const cache=new Map<string,Uint8Array>();
 function stateFor(ids:(number|bigint)[]){let state=grammar.initial;for(const raw of ids){const id=Number(raw);if(eosIds.has(id)){if(!grammar.complete(state))throw Error('Incomplete structured output');continue;}const bytes=pieces[id];if(!bytes)throw Error('Invalid structured token');const next=grammar.advance(state,bytes);if(!next)throw Error('Invalid structured continuation');state=next;}return state;}
 return {
  mask(ids:(number|bigint)[],scores:Float32Array){
   const state=stateFor(ids),key=state.nodes.join(',')+'|'+state.remaining+'|'+state.min+'|'+state.max;
   let allowed=cache.get(key);
   if(!allowed){allowed=new Uint8Array(scores.length);for(let id=0;id<scores.length;id++){const bytes=pieces[id];if(eosIds.has(id)?grammar.complete(state):bytes&&grammar.advance(state,bytes))allowed[id]=1;}if(cache.size>=256)cache.delete(cache.keys().next().value!);cache.set(key,allowed);}
   let finite=false;for(let id=0;id<scores.length;id++){if(!allowed[id])scores[id]=-Infinity;else if(Number.isFinite(scores[id]))finite=true;}
   if(!finite)throw Error('No valid structured continuation');
  },
  complete(ids:(number|bigint)[]){return grammar.complete(stateFor(ids));}
 };
}
