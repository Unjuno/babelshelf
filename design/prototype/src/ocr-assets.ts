import manifest from './ocr-manifest.json' with {type:'json'};
// @ts-expect-error Shared verified hash implementation is JavaScript.
import {SHA256} from '../../../dist/sha256.js';
export const ocrManifest=manifest;
export const OCR_LANGUAGES=['eng','jpn','eng+jpn'] as const;
export type OcrLanguage=typeof OCR_LANGUAGES[number];
export function ocrFiles(language:string){if(!OCR_LANGUAGES.includes(language as OcrLanguage))throw Error('Unsupported OCR language');return language.split('+').map(lang=>manifest.data.find(f=>f.language===lang)!);}
export const ocrModelPins=(language:string)=>ocrFiles(language).map(({language,revision,bytes,sha256})=>({language,revision,bytes,sha256}));
const cacheName='babelshelf-ocr-tesseract7-data1';
const cacheKey=(lang:string)=>new URL('/ocr-data/'+lang+'.traineddata.gz',location.origin).href;
export function verifyOcrBytes(file:{bytes:number;sha256:string},bytes:Uint8Array){if(bytes.length!==file.bytes||new SHA256().update(bytes).hex()!==file.sha256)throw Error('OCR asset verification failed');return bytes;}
export async function readOcrData(language:string){const cache=await caches.open(cacheName);return Promise.all(ocrFiles(language).map(async file=>{const response=await cache.match(cacheKey(file.language));if(!response)throw Error('OCR model not prepared');return {code:file.language,data:verifyOcrBytes(file,new Uint8Array(await response.arrayBuffer()))};}));}
export async function ocrReady(language:string){try{await readOcrData(language);return true;}catch{return false;}}
export async function prepareOcr(language:string,allowNetwork:boolean,signal:AbortSignal,progress:(s:string)=>void){
 const cache=await caches.open(cacheName),files=ocrFiles(language);
 for(const [i,file] of files.entries()){signal.throwIfAborted();progress('Preparing '+(i+1)+' / '+files.length);try{const old=await cache.match(cacheKey(file.language));if(old){verifyOcrBytes(file,new Uint8Array(await old.arrayBuffer()));signal.throwIfAborted();continue;}}catch{signal.throwIfAborted();}
  signal.throwIfAborted();if(!allowNetwork)throw Error('OCR model not prepared');const response=await fetch(file.url,{signal,credentials:'omit',referrerPolicy:'no-referrer'});if(!response.ok)throw Error('OCR download failed');const bytes=verifyOcrBytes(file,new Uint8Array(await response.arrayBuffer()));signal.throwIfAborted();await cache.put(cacheKey(file.language),new Response(bytes.slice().buffer));
 }
 signal.throwIfAborted();if(!await ocrReady(language))throw Error('OCR preparation failed');
}

export const ocrLanguageLabel=(language:OcrLanguage)=>({'eng':'English','jpn':'Japanese','eng+jpn':'English + Japanese'}[language]);
