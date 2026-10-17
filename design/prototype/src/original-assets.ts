// Immutable originals. Decoding/playback is not OCR, transcription or model understanding.
// @ts-expect-error Shared baseline is JavaScript.
import {createNote} from '../../../dist/core.js';
// @ts-expect-error Shared hash is JavaScript.
import {SHA256} from '../../../dist/sha256.js';
import {memoryFilePath} from './memory-paths.ts';
export type OriginalKind='text'|'image'|'audio'|'video'|'file';
export type OriginalRef={id:string;revision:1;sha256:string};
export type OriginalAsset={schema:1;type:'original-asset';id:string;revision:1;name:string;mime:string;kind:OriginalKind;bytes:number;sha256:string;createdAt:string;data:string};
export const MAX_ORIGINAL_BYTES=32*1024*1024;
export const MAX_ATTACHMENT_BATCH_BYTES=64*1024*1024;
const MAX_TEXT_BYTES=1024*1024;
export const originalKey=(id:string)=>'ui-v1-original-'+id;
export const originalRef=(a:OriginalAsset):OriginalRef=>({id:a.id,revision:a.revision,sha256:a.sha256});
export const TEXT_ATTACHMENT_ACCEPT='.txt,.md,.csv,.tsv,.json,.jsonl,.ndjson,.log,.yaml,.yml,.toml,.ini';
const additionalText=/\.(csv|tsv|json|jsonl|ndjson|log|yaml|yml|toml|ini)$/i;
export function originalKind(name:string,mime:string):OriginalKind{return additionalText.test(name)?'text':legacyOriginalKind(name,mime);}
// Historical classification remains valid for immutable retained originals.
function legacyOriginalKind(name:string,mime:string):OriginalKind{
 if(/\.(txt|md)$/i.test(name))return 'text';
 if(/\.(svgz?|html?|xml)$/i.test(name))return 'file';
 if(['image/png','image/jpeg','image/gif','image/webp','image/avif','image/bmp'].includes(mime))return 'image';
 if(mime.startsWith('audio/'))return 'audio';if(mime.startsWith('video/'))return 'video';return 'file';
}
const hash=(bytes:Uint8Array)=>new SHA256().update(bytes).hex();
function base64(bytes:Uint8Array){let result='';for(let i=0;i<bytes.length;i+=49152)result+=btoa(String.fromCharCode(...bytes.subarray(i,i+49152)));return result;}
function decode(data:string,bytes:number){
 if(data.length!==Math.ceil(bytes/3)*4||/[^a-zA-Z0-9+/=]/.test(data))throw Error('Original bytes invalid');
 const out=new Uint8Array(bytes);let offset=0;
 try{for(let i=0;i<data.length;i+=65536){const part=atob(data.slice(i,i+65536));if(offset+part.length>bytes)throw Error();for(let j=0;j<part.length;j++)out[offset++]=part.charCodeAt(j);}}catch{throw Error('Original encoding invalid');}
 if(offset!==bytes)throw Error('Original size invalid');return out;
}
export function checkAttachmentBatch(files:{size:number}[]){
 if(files.length>16)throw Error('Maximum 16 attachments');if(files.some(f=>!Number.isSafeInteger(f.size)||f.size<0||f.size>MAX_ORIGINAL_BYTES)||files.reduce((sum,f)=>sum+f.size,0)>MAX_ATTACHMENT_BATCH_BYTES)throw Error('Attachment too large · 32 MiB per file / 64 MiB total');
}
export async function prepareOriginal(file:File,id:string=crypto.randomUUID()):Promise<OriginalAsset>{
 checkAttachmentBatch([file]);const bytes=new Uint8Array(await file.arrayBuffer()),mime=file.type.toLowerCase()||'application/octet-stream';
 const asset:OriginalAsset={schema:1,type:'original-asset',id,revision:1,name:file.name,mime,kind:originalKind(file.name,mime),bytes:bytes.length,sha256:hash(bytes),createdAt:new Date().toISOString(),data:base64(bytes)};
 readOriginal(asset);return asset;
}
export function readOriginal(asset:OriginalAsset,ref?:OriginalRef):Uint8Array{
 if(!asset||asset.schema!==1||asset.type!=='original-asset'||typeof asset.id!=='string'||!asset.id||asset.id.length>128||asset.revision!==1||typeof asset.name!=='string'||!asset.name||asset.name.length>1024||typeof asset.mime!=='string'||! /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(asset.mime)||(asset.kind!==originalKind(asset.name,asset.mime)&&asset.kind!==legacyOriginalKind(asset.name,asset.mime))||!Number.isSafeInteger(asset.bytes)||asset.bytes<0||asset.bytes>MAX_ORIGINAL_BYTES||typeof asset.data!=='string'||typeof asset.createdAt!=='string'||!Number.isFinite(Date.parse(asset.createdAt))||typeof asset.sha256!=='string'||! /^[a-f0-9]{64}$/.test(asset.sha256))throw Error('Original metadata invalid');
 if(ref&&(ref.id!==asset.id||ref.revision!==1||ref.sha256!==asset.sha256))throw Error('Original identity changed');
 const bytes=decode(asset.data,asset.bytes);if(hash(bytes)!==asset.sha256)throw Error('Original verification failed');return bytes;
}
export function originalText(asset:OriginalAsset,bytes=readOriginal(asset)):{status:string;text?:string}{
 if(asset.kind!=='text')return {status:asset.kind==='file'?((asset.mime==='application/pdf'||/\.pdf$/i.test(asset.name))?'PDF original':'Unsupported'):asset.kind==='image'&&['image/png','image/jpeg'].includes(asset.mime)?'Image original':'Analysis not prepared'};
 if(bytes.length>MAX_TEXT_BYTES)return {status:'Text too large'};
 try{const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);if(text.includes('\0'))throw Error();return {status:'Text available',text};}catch{return {status:'Read failed'};}
}
export function originalNote(asset:OriginalAsset){
 const decoded=originalText(asset),base=asset.name.replace(/\.[^.]*$/,'').replace(/[\\/:*?"<>|\u0000-\u001f]/g,'-').replace(/[. ]+$/g,'').slice(0,96)||'Original',path=memoryFilePath('Attachments',base+'-'+asset.id.slice(0,8)),note=createNote({path,title:asset.name,body:decoded.text??''});
 return {...note,id:asset.id,originalAsset:originalRef(asset),importedFrom:{name:asset.name,bytes:asset.bytes},...(decoded.text!==undefined?{attachmentText:{assetId:asset.id,assetRevision:1,sha256:asset.sha256,processor:'utf-8-textdecoder-v1',status:'complete',start:0,end:asset.bytes,unit:'bytes',noteRevision:1}}:{})};
}
export function validateOriginalLinks(notes:any[],settings:{key:string;value:any}[],runs:{key:string;value:any}[]){
 const map=new Map<string,OriginalAsset>();for(const {key,value} of runs)if(key.startsWith('ui-v1-original-')||value?.type==='original-asset'){readOriginal(value);if(key!==originalKey(value.id))throw Error('Original storage identity invalid');map.set(value.id,value);}
 for(const asset of map.values())if(!notes.some(n=>n.id===asset.id&&n.originalAsset?.id===asset.id))throw Error('Original note unavailable');
 const check=(ref:OriginalRef)=>{const asset=map.get(ref?.id);if(!asset)throw Error('Original unavailable');if(ref.revision!==1||asset.sha256!==ref.sha256)throw Error('Original reference invalid');return asset;};
 for(const n of notes)if(n.originalAsset){const asset=check(n.originalAsset);if(n.id!==asset.id)throw Error('Original note identity invalid');
  const original=originalNote(asset);if(JSON.stringify(n.attachmentText)!==JSON.stringify(original.attachmentText)||n.revisions[0].body!==original.revisions[0].body)throw Error('Original text provenance invalid');
 }
 for(const {key,value} of settings)if(key==='ui-v1-dialogue')for(const turn of value.turns??[])for(const a of turn.attachments??[])if(a.asset){const original=check(a.asset);if(a.id!==original.id||a.name!==original.name||a.kind!==original.kind)throw Error('Attachment identity invalid');}
}
