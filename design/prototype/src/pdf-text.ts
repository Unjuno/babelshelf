import {readOriginal,originalRef,type OriginalAsset,type OriginalRef} from './original-assets.ts';
// @ts-expect-error Canonical baseline is JavaScript.
import {createNote} from '../../../dist/core.js';
export const PDF_PROCESSOR='pdfjs-dist-6.4.299';
export const PDF_MAX_PAGES=40,PDF_MAX_TEXT=100000;
export type PdfRegion={start:number;end:number;rect:number[]};
export type PdfPage={page:number;text:string;regions:PdfRegion[]};
export type PdfText={schema:1;processor:typeof PDF_PROCESSOR;original:OriginalRef;totalPages:number;status:'complete'|'partial';text:string;pages:(PdfPage&{start:number;end:number})[]};
export const isPdf=(a:{name:string;mime?:string;kind?:string})=>(!a.kind||a.kind==='file')&&(a.mime==='application/pdf'||/\.pdf$/i.test(a.name));
export function makePdfText(asset:OriginalAsset,totalPages:number,pages:PdfPage[]):PdfText {
 let cursor=0;const mapped=pages.map((p,i)=>{if(i)cursor+=2;const start=cursor;cursor+=p.text.length;return {...structuredClone(p),start,end:cursor};});
 const value:PdfText={schema:1,processor:PDF_PROCESSOR,original:originalRef(asset),totalPages,status:pages.length===totalPages?'complete':'partial',text:pages.map(p=>p.text).join('\n\n'),pages:mapped};validatePdfText(value,asset);return value;
}
export function validatePdfText(v:PdfText,asset:OriginalAsset){
 readOriginal(asset,v?.original);
 if(!isPdf(asset)||v?.schema!==1||v.processor!==PDF_PROCESSOR||!Number.isInteger(v.totalPages)||v.totalPages<1||v.totalPages>5000||!Array.isArray(v.pages)||!v.pages.length||v.pages.length>Math.min(PDF_MAX_PAGES,v.totalPages)||v.status!==(v.pages.length===v.totalPages?'complete':'partial')||typeof v.text!=='string'||/[\uD800-\uDFFF]/u.test(v.text)||v.text.includes('\0')||v.text.length>PDF_MAX_TEXT)throw Error('PDF extraction metadata invalid');
 let cursor=0;for(const [i,p] of v.pages.entries()){if(i)cursor+=2;if(p.page!==i+1||typeof p.text!=='string'||p.start!==cursor||p.end!==cursor+p.text.length||!Array.isArray(p.regions)||p.regions.length>10000)throw Error('PDF page range invalid');cursor=p.end;for(const r of p.regions)if(!Number.isInteger(r.start)||!Number.isInteger(r.end)||r.start<0||r.end<=r.start||r.end>p.text.length||!Array.isArray(r.rect)||r.rect.length!==4||r.rect.some(x=>!Number.isFinite(x)||x<0||x>1)||r.rect[2]<=0||r.rect[3]<=0||r.rect[0]+r.rect[2]>1.00001||r.rect[1]+r.rect[3]>1.00001)throw Error('PDF text region invalid');}
 if(v.pages.map(p=>p.text).join('\n\n')!==v.text)throw Error('PDF extraction text invalid');
}
export function pdfTextNote(id:string,asset:OriginalAsset,v:PdfText){validatePdfText(v,asset);if(!v.text.trim())throw Error('No PDF text · OCR not prepared');return {...createNote({path:'Attachments/PDF-'+id+'.md',title:asset.name+' text',body:v.text}),id,mediaSource:originalRef(asset),pdfText:structuredClone(v)};}
export function validatePdfLinks(notes:any[],runs:{key:string;value:any}[]){for(const n of notes)if(n.pdfText){const asset=runs.find(r=>r.value?.type==='original-asset'&&r.value.id===n.mediaSource?.id)?.value;if(!asset||n.transcription||n.ocrText||n.originalAsset||n.id===asset.id)throw Error('PDF original unavailable');validatePdfText(n.pdfText,asset);if(JSON.stringify(n.mediaSource)!==JSON.stringify(n.pdfText.original)||n.revisions[0].body!==n.pdfText.text)throw Error('PDF original text changed');}}
export function pdfCitationPage(v:PdfText,body:string,revision:number,start:number,end:number,citedQuote?:string){
 if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<=start||end>body.length)throw Error('Source range invalid');
 if(revision!==1||body!==v.text)return {page:1,label:'Original PDF · edited text',regions:[] as number[][]};
 const excerpt=body.slice(start,end),at=citedQuote?excerpt.indexOf(citedQuote):-1;if(citedQuote&&at>=0&&excerpt.indexOf(citedQuote,at+1)<0){start+=at;end=start+citedQuote.length;}
 const pages=v.pages.filter(p=>p.start<end&&p.end>start);if(!pages.length)return {page:1,label:'Original PDF · page unavailable',regions:[] as number[][]};const p=pages[0];return {page:p.page,label:pages.length===1?'Page '+p.page:'Pages '+p.page+'–'+pages.at(-1)!.page,regions:p.regions.filter(r=>p.start+r.start<end&&p.start+r.end>start).map(r=>r.rect)};
}
