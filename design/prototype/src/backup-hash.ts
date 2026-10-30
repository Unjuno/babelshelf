// Keep ordinary persistence checks independent from the full backup validator.
// @ts-expect-error Shared hash is JavaScript.
import {SHA256} from '../../../dist/sha256.js';
import {visitJsonChunks} from './json-chunks.ts';
import {visitUtf8Chunks} from './utf8-text.ts';

export function encodeBackupValue(value:any){
 const undefinedPaths:string[][]=[];
 const walk=(v:any,path:string[]):any=>{
  if(v===undefined){undefinedPaths.push(path);return null;}
  if(Array.isArray(v))return v.map((x,i)=>walk(x,[...path,String(i)]));
  if(v&&typeof v==='object'){const out=Object.create(null);for(const [key,item] of Object.entries(v))out[key]=walk(item,[...path,key]);return out;}
  return v;
 };
 return {data:walk(value,[]),undefinedPaths};
}

export const stateHash=(value:unknown):string=>{const hash=new SHA256();visitJsonChunks(encodeBackupValue(value),text=>visitUtf8Chunks(text,bytes=>hash.update(bytes)));return hash.hex();};
