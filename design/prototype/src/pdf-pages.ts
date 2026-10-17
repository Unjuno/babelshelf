import type {OriginalAsset} from './original-assets.ts';
import {makePdfText,PDF_MAX_PAGES,PDF_MAX_TEXT,type PdfPage} from './pdf-text.ts';
// Sequential page coverage. An OCR error/Stop never silently becomes an empty page.
export async function readPdfPages(asset:OriginalAsset,total:number,read:(page:number)=>Promise<PdfPage>,signal:AbortSignal,progress:(page:number,total:number)=>void,ocr?:(page:number)=>Promise<Omit<PdfPage,'page'>>){
 const check=()=>{if(signal.aborted)throw Error('Stopped');};check();
 const pages:PdfPage[]=[];let length=0;
 for(let number=1;number<=Math.min(PDF_MAX_PAGES,total);number++){
  check();progress(number,total);let page=await read(number);check();
  if(!page.text.trim()&&ocr){page={...await ocr(number),page:number};check();}
  if(length+(pages.length?2:0)+page.text.length>PDF_MAX_TEXT){if(!pages.length)throw Error('PDF page text too large');break;}
  pages.push(page);length+=(pages.length>1?2:0)+page.text.length;
 }
 check();return makePdfText(asset,total,pages);
}
