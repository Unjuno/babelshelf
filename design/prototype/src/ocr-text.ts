import {ocrManifest,ocrModelPins,ocrFiles,type OcrLanguage} from './ocr-assets.ts';
import {readOriginal,originalRef,type OriginalAsset,type OriginalRef} from './original-assets.ts';
// @ts-expect-error Canonical baseline is JavaScript.
import {createNote} from '../../../dist/core.js';
export type OcrRegion={start:number;end:number;rect:number[]};
export type OcrImage={width:number;height:number;processedWidth:number;processedHeight:number;frame:0;orientation:'browser-decoded'};
export type OcrText={schema:1;processor:string;language:OcrLanguage;original:OriginalRef;modelFiles:ReturnType<typeof ocrModelPins>;image:OcrImage;text:string;regions:OcrRegion[]};
export const isOcrImage=(a:{kind?:string;mime?:string})=>(!a.kind||a.kind==='image')&&['image/png','image/jpeg'].includes(a.mime??'');
export function validateOcrText(v:OcrText,asset:OriginalAsset){
 readOriginal(asset,v?.original);ocrFiles(v?.language);const im=v?.image;
 if(!isOcrImage(asset)||v.schema!==1||v.processor!==ocrManifest.processor||JSON.stringify(v.modelFiles)!==JSON.stringify(ocrModelPins(v.language))||!im||[im.width,im.height,im.processedWidth,im.processedHeight].some(n=>!Number.isInteger(n)||n<1)||im.width*im.height>64000000||im.processedWidth>im.width||im.processedHeight>im.height||Math.max(im.processedWidth,im.processedHeight)>4096||im.processedWidth*im.processedHeight>8000000||Math.abs(im.processedWidth*im.height-im.processedHeight*im.width)>im.width+im.height||im.frame!==0||im.orientation!=='browser-decoded'||typeof v.text!=='string'||v.text.length>100000||v.text.includes('\0')||/[\uD800-\uDFFF]/u.test(v.text)||!Array.isArray(v.regions)||v.regions.length>10000)throw Error('OCR extraction metadata invalid');
 for(const r of v.regions)if(!Number.isInteger(r.start)||!Number.isInteger(r.end)||r.start<0||r.end<=r.start||r.end>v.text.length||!Array.isArray(r.rect)||r.rect.length!==4||r.rect.some(n=>!Number.isFinite(n)||n<0||n>1)||r.rect[2]<=0||r.rect[3]<=0||r.rect[0]+r.rect[2]>1.00001||r.rect[1]+r.rect[3]>1.00001)throw Error('OCR text region invalid');
}
export function makeOcrText(asset:OriginalAsset,language:OcrLanguage,image:OcrImage,text:string,regions:OcrRegion[]):OcrText{const v:OcrText={schema:1,processor:ocrManifest.processor,language,original:originalRef(asset),modelFiles:ocrModelPins(language),image:structuredClone(image),text,regions:structuredClone(regions)};validateOcrText(v,asset);return v;}
export function ocrTextNote(id:string,asset:OriginalAsset,v:OcrText){validateOcrText(v,asset);if(!v.text.trim())throw Error('No image text found');return {...createNote({path:'Attachments/OCR-'+id+'.md',title:asset.name+' OCR',body:v.text}),id,mediaSource:originalRef(asset),ocrText:structuredClone(v)};}
export function validateOcrLinks(notes:any[],runs:{key:string;value:any}[]){for(const n of notes)if(n.ocrText){const asset=runs.find(r=>r.value?.type==='original-asset'&&r.value.id===n.mediaSource?.id)?.value;if(!asset||n.pdfText||n.transcription||n.originalAsset||n.id===asset.id)throw Error('OCR original unavailable');validateOcrText(n.ocrText,asset);if(JSON.stringify(n.mediaSource)!==JSON.stringify(n.ocrText.original)||n.revisions[0].body!==n.ocrText.text)throw Error('OCR original text changed');}}
export function ocrCitationRegion(v:OcrText,body:string,revision:number,start:number,end:number,citedQuote?:string){
 if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<=start||end>body.length)throw Error('Source range invalid');if(revision!==1||body!==v.text)return {label:'Original image · edited text',regions:[] as number[][]};const excerpt=body.slice(start,end),at=citedQuote?excerpt.indexOf(citedQuote):-1;if(citedQuote&&at>=0&&excerpt.indexOf(citedQuote,at+1)<0){start+=at;end=start+citedQuote.length;}
 const regions=v.regions.filter(r=>r.start<end&&r.end>start).map(r=>r.rect);return {label:regions.length?'Image region · OCR':'Whole image · alignment unavailable',regions};
}

export function ocrRegions(text:string,blocks:any[],width:number,height:number):OcrRegion[]{
 const regions:OcrRegion[]=[];let cursor=0;for(const block of blocks??[])for(const paragraph of block.paragraphs??[])for(const line of paragraph.lines??[]){const part=typeof line.text==='string'?line.text.trimEnd():'';if(!part)continue;const start=text.indexOf(part,cursor),b=line.bbox;if(start<0)return [];cursor=start+part.length;if(!b||![b.x0,b.y0,b.x1,b.y1].every(Number.isFinite)||b.x0<0||b.y0<0||b.x1>width||b.y1>height||b.x1<=b.x0||b.y1<=b.y0)continue;regions.push({start,end:cursor,rect:[b.x0/width,b.y0/height,(b.x1-b.x0)/width,(b.y1-b.y0)/height]});}return regions;
}
