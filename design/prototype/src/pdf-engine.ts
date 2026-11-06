import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {readOriginal,type OriginalAsset} from './original-assets';
import type {PdfPage} from './pdf-text';
import {readPdfPages} from './pdf-pages';
import type {OcrLanguage} from './ocr-assets';
const cmaps=import.meta.glob('../node_modules/pdfjs-dist/cmaps/*.bcmap',{eager:true,query:'?url',import:'default'}) as Record<string,string>;
const fonts=import.meta.glob('../node_modules/pdfjs-dist/standard_fonts/*.{pfb,ttf}',{eager:true,query:'?url',import:'default'}) as Record<string,string>;
const assets=new Map(Object.entries({...cmaps,...fonts}).map(([path,url])=>[path.split('/').at(-1)!,url]));
class LocalPdfData {async fetch({kind,filename}:{kind:string;filename:string}){if(!['cMapUrl','standardFontDataUrl'].includes(kind))throw Error('PDF resource unsupported');const path=assets.get(filename);if(!path)throw Error('PDF resource missing');const url=new URL(path,location.href);if(url.origin!==location.origin&&url.protocol!=='data:')throw Error('PDF resource not local');const r=await fetch(url.href,{credentials:'same-origin'});if(!r.ok)throw Error('PDF resource unavailable');return new Uint8Array(await r.arrayBuffer());}}
async function withPdf<T>(asset:OriginalAsset,signal:AbortSignal,work:(doc:any,api:typeof import('pdfjs-dist'))=>Promise<T>):Promise<T>{
 if(signal.aborted)throw Error('Stopped');const api=await import('pdfjs-dist');api.GlobalWorkerOptions.workerSrc=workerUrl;if(signal.aborted)throw Error('Stopped');
 const task=api.getDocument({data:readOriginal(asset).slice(),useWorkerFetch:false,BinaryDataFactory:LocalPdfData,cMapUrl:'local/',standardFontDataUrl:'local/',useWasm:false,enableXfa:false,disableFontFace:true,useSystemFonts:true,stopAtErrors:true,maxImageSize:4000000,canvasMaxAreaInBytes:16000000,verbosity:0});
 const stop=()=>{void task.destroy();};signal.addEventListener('abort',stop,{once:true});try{const doc=await task.promise;if(signal.aborted)throw Error('Stopped');if(doc.numPages>5000)throw Error('PDF too long');return await work(doc,api);}finally{signal.removeEventListener('abort',stop);await task.destroy();}
}
export async function extractPdf(asset:OriginalAsset,signal:AbortSignal,progress:(page:number,total:number)=>void,ocr?:{language:OcrLanguage;progress:(s:string)=>void;beforeOcr?:()=>Promise<void>}){
 return withPdf(asset,signal,async(doc,api)=>readPdfPages(asset,doc.numPages,async number=>{
  const page=await doc.getPage(number);try{const viewport=page.getViewport({scale:1}),content=await page.getTextContent();let text='';const regions:PdfPage['regions']=[];
   for(const item of content.items){if(typeof item.str!=='string')continue;const start=text.length;text+=item.str;const end=text.length;if(end>start){const tr=api.Util.transform(viewport.transform,item.transform),height=Math.max(1,Math.hypot(tr[2],tr[3])),x=Math.max(0,Math.min(.999,tr[4]/viewport.width)),y=Math.max(0,Math.min(.999,(tr[5]-height)/viewport.height)),w=Math.min(1-x,Math.abs(item.width)/viewport.width),h=Math.min(1-y,height/viewport.height);if(w>0&&h>0)regions.push({start,end,rect:[x,y,w,h]});}text+=item.hasEOL?'\n':' ';}
   text=text.trimEnd();return {page:number,text,regions:regions.filter(r=>r.end<=text.length)};
  }finally{page.cleanup();}
 },signal,progress,ocr?async number=>{
  ocr.progress('Page '+number+' / '+doc.numPages+' · Rendering');const page=await doc.getPage(number),canvas=document.createElement('canvas');let render:any;const stop=()=>render?.cancel();signal.addEventListener('abort',stop,{once:true});
  try{signal.throwIfAborted();const raw=page.getViewport({scale:1});if(!Number.isFinite(raw.width)||!Number.isFinite(raw.height)||raw.width<=0||raw.height<=0)throw Error('PDF page size invalid');const scale=Math.min(2.5,2000/raw.width,2800/raw.height),viewport=page.getViewport({scale});canvas.width=Math.max(1,Math.ceil(viewport.width));canvas.height=Math.max(1,Math.ceil(viewport.height));
   render=page.render({canvas,viewport,background:'rgb(255,255,255)'});await render.promise;signal.throwIfAborted();
   const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('PDF image conversion failed')),'image/png'));signal.throwIfAborted();
   const {recognizeRaster}=await import('./ocr-engine');return await recognizeRaster(new Uint8Array(await blob.arrayBuffer()),canvas.width,canvas.height,ocr.language,signal,label=>ocr.progress('Page '+number+' / '+doc.numPages+' · '+label));
  }finally{signal.removeEventListener('abort',stop);canvas.width=1;canvas.height=1;page.cleanup();}
 }:undefined,ocr?.beforeOcr));
}
export async function renderPdfPage(asset:OriginalAsset,number:number,regions:number[][],signal:AbortSignal){return withPdf(asset,signal,async doc=>{if(!Number.isInteger(number)||number<1||number>doc.numPages)throw Error('PDF page unavailable');const page=await doc.getPage(number),raw=page.getViewport({scale:1}),scale=Math.min(1.5,1000/raw.width,1400/raw.height),viewport=page.getViewport({scale}),canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);await page.render({canvas,viewport}).promise;if(signal.aborted)throw Error('Stopped');const ctx=canvas.getContext('2d')!;ctx.fillStyle='rgba(255,200,0,0.22)';ctx.strokeStyle='#886300';ctx.lineWidth=2;for(const [x,y,w,h] of regions){ctx.fillRect(x*canvas.width,y*canvas.height,w*canvas.width,h*canvas.height);ctx.strokeRect(x*canvas.width,y*canvas.height,w*canvas.width,h*canvas.height);}return {image:canvas.toDataURL('image/png'),pages:doc.numPages};});}
