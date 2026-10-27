import {normalizePath,defaultPath,notePath,assertPaths} from './files.js';
// Pure knowledge operations. Offsets are UTF-16 code units, matching String.slice.
export const latest=n=>n.revisions.at(-1);
const clone=v=>structuredClone(v);
// Search folding is transient. Originals and UTF-16 citation offsets stay literal.
export const normalizeSearchText=s=>s.normalize('NFKC').toLocaleLowerCase('ja').replace(/\s+/g,' ').trim();
const norm=normalizeSearchText;
export function createNote({title='',body='',aliases=[],kind='original',sources=[],path}={}){
 if(typeof title!=='string'||typeof body!=='string'||!['original','generated'].includes(kind))throw Error('Invalid note');
 const at=new Date().toISOString(),id=crypto.randomUUID();return {id,kind,state:'active',createdAt:at,aliases:[...aliases],sources:clone(sources),revisions:[{version:1,title,body,path:path===undefined?defaultPath(title,id):normalizePath(path),at}]};
}
export function reviseNote(note,patch,expected){
 if(latest(note).version!==expected)throw Error('Version conflict');
 if(note.state!=='active')throw Error('Note withdrawn');
 const n=clone(note),p=latest(n);n.revisions.push({version:p.version+1,title:patch.title??p.title,body:patch.body??p.body,path:patch.path===undefined?notePath(note):normalizePath(patch.path),at:new Date().toISOString()});
 if(patch.aliases)n.aliases=[...patch.aliases];return n;
}
export function withdrawNote(note,expected){const n=reviseNote(note,{},expected);n.state='withdrawn';n.withdrawnAt=new Date().toISOString();return n;}
export function chunks(body,max=700){
 const out=[];let start=0;for(const part of body.split(/(\n\s*\n)/)){
  if(part.trim())for(let i=0;i<part.length;i+=max)out.push({start:start+i,end:start+Math.min(part.length,i+max),quote:part.slice(i,i+max)});
  start+=part.length;
 }return out;
}
function grams(s){s=norm(s);const c=Array.from(s);return c.length<2?c:[...new Set(c.slice(0,-1).map((v,i)=>v+c[i+1]))];}
// Latin words/codes use lexical boundaries; unsegmented scripts retain character grams.
const wordPattern=/(?:[\p{Script=Latin}\p{Nd}]\p{M}*)+(?:[-_](?:[\p{Script=Latin}\p{Nd}]\p{M}*)+)*/gu;
const words=s=>[...s.matchAll(wordPattern)].map(m=>m[0]);
function searchTerms(s){return [...words(s),...[...s.replace(wordPattern,' ').matchAll(/[\p{L}\p{N}\p{M}\p{Extended_Pictographic}]+/gu)].flatMap(m=>grams(m[0]))];}
function searchChunks(body,max=700){
 const spans=[...body.matchAll(wordPattern)].map(m=>({start:m.index,end:m.index+m[0].length})),out=[],seen=new Set();let a=0,b=0;
 for(const c of chunks(body,max)){
  while(spans[a]?.end<=c.start)a++;while(spans[b]?.end<c.end)b++;
  let {start,end}=c;const left=spans[a],right=spans[b];
  if(left&&left.start<start&&left.end>start)start=left.end-left.start<=max?left.start:left.end;
  if(right&&right.start<end&&right.end>end)end=right.end-right.start<=max?right.end:right.start;
  const key=start+':'+end;if(end>start&&!seen.has(key)){seen.add(key);out.push({start,end,quote:body.slice(start,end)});}
 }return out;
}
function mediaAvailable(n,map){if(!n?.mediaSource)return true;const source=map.get(n.mediaSource.id);return source?.state==='active'&&source.originalAsset?.id===n.mediaSource.id&&source.originalAsset.revision===n.mediaSource.revision&&source.originalAsset.sha256===n.mediaSource.sha256;}
export function validateRefs(notes,refs,{currentOnly=false}={}){
 const map=new Map(notes.map(n=>[n.id,n]));const errors=[];
 for(const r of refs){const n=map.get(r.noteId),v=n?.revisions.find(v=>v.version===r.revision);
  if(!n||n.state!=='active'||!mediaAvailable(n,map)||!v||!Number.isInteger(r.start)||!Number.isInteger(r.end)||r.start<0||r.end<=r.start||r.end>v.body.length||v.body.slice(r.start,r.end)!==r.quote||(currentOnly&&latest(n).version!==r.revision))errors.push(r.noteId??'unknown');
 }return {ok:errors.length===0,errors};
}
function eligible(n,map,seen=new Set()){
 if(n.state!=='active'||!mediaAvailable(n,map)||seen.has(n.id))return false;
 if(n.kind!=='generated')return true;
 seen=new Set([...seen,n.id]);return n.sources.length>0&&n.sources.every(r=>{const parent=map.get(r.noteId);return parent&&validateRefs([...map.values()],[r],{currentOnly:true}).ok&&eligible(parent,map,seen);});
}
// Admission for NEW grounded data. Historical citation display keeps validateRefs semantics.
export function validateGroundingRefs(notes,refs){
 const checked=validateRefs(notes,refs,{currentOnly:true}),map=new Map(notes.map(n=>[n.id,n])),errors=new Set(checked.errors);
 for(const ref of refs){const note=map.get(ref.noteId);if(note&&!eligible(note,map))errors.add(ref.noteId);}
 return {ok:errors.size===0,errors:[...errors]};
}
const indexCache=new WeakMap(),storedIndexCache=new WeakMap();
export function buildIndex(notes,{force=false}={}){return buildNoteIndex(notes,force,false);}
function buildNoteIndex(notes,force,stored){
 const cache=stored?storedIndexCache:indexCache;if(!force&&cache.has(notes))return cache.get(notes);
 const map=new Map(notes.map(n=>[n.id,n])),docs=[],postings=new Map();
 for(const n of notes){if(stored?n.state!=='active':!eligible(n,map))continue;const v=latest(n);for(const c of searchChunks(v.body)){
  const filename=notePath(n).split('/').at(-1).replace(/\.md$/i,''),text=norm(c.quote),head=norm(v.title+' '+filename+' '+n.aliases.join(' ')),tokens=searchTerms(text),textWords=words(text),headWords=words(head),i=docs.length;docs.push({n,v,c,text,head,tokens,textWords,headWords});
  for(const term of new Set([...tokens,...searchTerms(head),...Array.from(text+head)])){if(!postings.has(term))postings.set(term,new Set());postings.get(term).add(i);}
 }}
 const index={docs,postings,avg:docs.reduce((s,d)=>s+d.tokens.length,0)/Math.max(1,docs.length)};cache.set(notes,index);return index;
}
export function searchNotes(notes,query,limit=8){return searchIndexedNotes(notes,query,limit,false);}
// File discovery does not authorize using a result as current grounding evidence.
export function searchStoredNotes(notes,query,limit=8){const map=new Map(notes.map(n=>[n.id,n]));return searchIndexedNotes(notes,query,limit,true).map(hit=>({...hit,groundingEligible:eligible(map.get(hit.noteId),map)}));}
function searchIndexedNotes(notes,query,limit,stored){
 const q=norm(query);if(!q)return [];
 const terms=searchTerms(q),lexical=new Set(words(q)),required=[...lexical].filter(t=>/[\p{Nd}_-]/u.test(t)),{docs,postings,avg}=buildNoteIndex(notes,false,stored),candidates=new Set(terms.flatMap(t=>[...(postings.get(t)??[])]));
 const ranked=[...candidates].map(i=>{const d=docs[i];if(required.some(t=>!d.textWords.includes(t)&&!d.headWords.includes(t)))return null;let score=0;for(const t of terms){const count=lexical.has(t)?d.textWords.filter(w=>w===t).length:d.text.split(t).length-1,df=postings.get(t)?.size??0;const idf=Math.log(1+(docs.length-df+.5)/(df+.5));if(count)score+=idf*count*2.2/(count+1.2*(.25+.75*d.tokens.length/Math.max(1,avg)));if(lexical.has(t)?d.headWords.includes(t):d.head.includes(t))score+=idf*2;}
  if(!score)return null;
  if(d.text.includes(q))score+=20;if(d.head.includes(q))score+=30;
  return {noteId:d.n.id,revision:d.v.version,title:d.v.title,...d.c,score};
 }).filter(h=>h&&h.score>0).sort((a,b)=>b.score-a.score||a.noteId.localeCompare(b.noteId)||a.start-b.start);
 const cap=Math.max(1,Math.min(20,limit));if(!stored)return ranked.slice(0,cap);
 // Discovery shows one row per file. Reserve a slot for each matching file
 // before filling spare slots with additional passages from the same file.
 const seen=new Set(),first=[],extra=[];for(const hit of ranked){if(seen.has(hit.noteId))extra.push(hit);else{seen.add(hit.noteId);first.push(hit);}}
 return first.concat(extra).slice(0,cap);
}
export function resolveLinks(note,notes){
 const text=latest(note).body;const matches=[...text.matchAll(/\[\[([^\]\n]+)\]\]|\[[^\]\n]*\]\((note:[a-zA-Z0-9-]+)\)/g)];
 return matches.map(m=>{const target=m[1]??m[2];const choices=target.startsWith('note:')?notes.filter(n=>n.id===target.slice(5)):notes.filter(n=>norm(latest(n).title)===norm(target)||n.aliases.some(a=>norm(a)===norm(target)));
  return {label:target,status:choices.length>1?'ambiguous':choices.length===0?'missing':choices[0].state==='active'?'resolved':'withdrawn',targetId:choices.length===1?choices[0].id:null};});
}
export async function digest(text){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function makeBackup(notes){const payload={schema:1,createdAt:new Date().toISOString(),notes:clone(notes)};return {format:'mobile-local-brainpack',sha256:await digest(JSON.stringify(payload)),payload};}
export function checkNotes(notes){
 if(!Array.isArray(notes)||notes.length>20000)throw Error('Invalid note count');const ids=new Set();
 for(const n of notes){
  if(!n||typeof n.id!=='string'||!n.id||ids.has(n.id)||!['active','withdrawn'].includes(n.state)||!['original','generated'].includes(n.kind)||!Array.isArray(n.aliases)||n.aliases.some(a=>typeof a!=='string')||!Array.isArray(n.sources)||!Array.isArray(n.revisions)||!n.revisions.length)throw Error('Invalid note schema');ids.add(n.id);
  for(const [i,v]of n.revisions.entries())if(!v||v.version!==i+1||typeof v.title!=='string'||typeof v.body!=='string'||v.body.length>10000000||typeof v.at!=='string')throw Error('Invalid revision');
 }
 for(const n of notes)for(const v of n.revisions)if(v.path!==undefined)normalizePath(v.path);assertPaths(notes);
 for(const n of notes)for(const r of n.sources){const v=notes.find(n=>n.id===r.noteId)?.revisions.find(v=>v.version===r.revision);if(!v||!Number.isInteger(r.start)||!Number.isInteger(r.end)||r.start<0||r.end<=r.start||r.end>v.body.length||v.body.slice(r.start,r.end)!==r.quote)throw Error('Invalid source reference');}
 return true;
}
export async function parseBackup(text){
 if(text.length>200000000)throw Error('Backup too large');const pack=JSON.parse(text);
 if(pack.format!=='mobile-local-brainpack'||pack.payload?.schema!==1||pack.sha256!==await digest(JSON.stringify(pack.payload)))throw Error('Backup verification failed');checkNotes(pack.payload.notes);return pack.payload;
}
export function mergeNotes(existing,incoming){
 const map=new Map(existing.map(n=>[n.id,clone(n)])),conflicts=[];
 for(const n of incoming){const old=map.get(n.id);if(!old){map.set(n.id,clone(n));continue;}if(JSON.stringify(old)!==JSON.stringify(n))conflicts.push({id:n.id,title:latest(n).title,reason:'ID conflict · local note kept'});}
 const merged=[...map.values()];checkNotes(merged);return {notes:merged,conflicts};
}
export function validateTool(call,notes){
 const a=call?.arguments;if(!a||typeof a!=='object'||Array.isArray(a))throw Error('Invalid action');
 switch(call.name){
  case 'search_notes':if(typeof a.query!=='string'||a.query.length>2000||a.limit!==undefined&&(!Number.isInteger(a.limit)||a.limit<1||a.limit>20))throw Error('Invalid search');break;
  case 'read_note':if(typeof a.note_id!=='string'||!notes.some(n=>n.id===a.note_id&&n.state==='active'))throw Error('Note unavailable');break;
  case 'create_note':if(typeof a.title!=='string'||typeof a.body!=='string'||a.body.length>30000||!Array.isArray(a.source_refs)||!validateGroundingRefs(notes,a.source_refs).ok)throw Error('Invalid note or sources');break;
  default:throw Error('Action not allowed');
 }return call;
}
export function parseJSON(text){const s=text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');return JSON.parse(s);}
export function parseAnswer(text,evidence){const value=parseJSON(text);if(!value||typeof value!=='object'||Array.isArray(value)||value.status!==undefined&&!['answered','insufficient_evidence'].includes(value.status)||typeof value.answer!=='string'||!value.answer.trim()||!Array.isArray(value.citations))throw Error('Invalid answer or sources');
 if(value.status==='insufficient_evidence'){if(value.citations.length)throw Error('Insufficient evidence cannot carry citations');return {status:value.status,answer:value.answer,refs:[]};}
 if(!value.citations.length)throw Error('Invalid answer or sources');
 const refs=[];for(const c of value.citations){const r=evidence.find(r=>r.label===c.id);if(!r||typeof c.quote!=='string'||!c.quote||!r.quote.includes(c.quote))throw Error('Citation mismatch');refs.push({...r,citedQuote:c.quote});}return {...(value.status?{status:value.status}:{}),answer:value.answer,refs};}
