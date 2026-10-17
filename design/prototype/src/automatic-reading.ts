import {buildInputReadings,readingStatus,type ReviewedText} from './input-readings.ts';
import {isOcrImage,type OcrText} from './ocr-text.ts';
import {isPdf,type PdfText} from './pdf-text.ts';
import type {Transcript} from './speech-transcript.ts';
import {originalKey,originalRef,type OriginalAsset} from './original-assets.ts';
import {stateHash} from './backup-state.ts';
import type {ProcessingTool} from './processing-history.ts';
export type ReadingPolicy={ocrModel:string;ocrReady:boolean;ocrLanguage:string;speechModel:string;speechReady:boolean;speechLanguage:string};
type Adapter<T>=(asset:OriginalAsset,signal:AbortSignal,progress:(s:string)=>void)=>Promise<T>;
export type ReadingAdapters={ocr?:Adapter<OcrText>;pdf?:Adapter<PdfText>;speech?:Adapter<Transcript>};
type RecordRead=<T>(tool:ProcessingTool,input:unknown,work:()=>Promise<T>,project:(result:T)=>unknown)=>Promise<T>;
export async function readInputOriginal(asset:OriginalAsset,policy:ReadingPolicy,adapters:ReadingAdapters,signal:AbortSignal,progress:(s:string)=>void,record:RecordRead):Promise<{reading?:ReviewedText;status:string}>{
 const check=()=>{if(signal.aborted)throw Error('Stopped');};check();
 const kind=isOcrImage(asset)?'ocr':isPdf(asset)?'pdf':asset.kind==='audio'||asset.kind==='video'?'speech':undefined;
 if(!kind)return {status:'Unsupported'};
 let workError:unknown;
 const tool=kind==='ocr'?'image.read':kind==='pdf'?'pdf.read':'speech.transcribe';
 try{
  const reading=await record(tool,{source:{...originalRef(asset),name:asset.name},automatic:true,...(kind==='ocr'?{language:policy.ocrLanguage,model:policy.ocrModel}:kind==='speech'?{language:policy.speechLanguage,model:policy.speechModel}:kind==='pdf'?{ocrPolicy:{model:policy.ocrModel,prepared:policy.ocrReady,language:policy.ocrLanguage}}:{})},async()=>{try{
   check();if(kind==='ocr'&&(policy.ocrModel!=='tesseract-7'||!policy.ocrReady))throw Error('Image text not prepared');
   if(kind==='speech'&&(policy.speechModel!=='whisper-tiny'||!policy.speechReady))throw Error('Speech to text not prepared');
   const adapter=adapters[kind];if(!adapter)throw Error('Reader unsupported');progress(kind==='speech'?'Transcribing':'Reading');
   const value=await adapter(asset,signal,progress);check();if(!value.text?.trim())throw Error(kind==='pdf'&&!(value as PdfText).pages.some(p=>p.ocr)?'No text layer · OCR required':'No text found');
   const result={kind,id:crypto.randomUUID(),value} as ReviewedText;buildInputReadings([result],[{key:originalKey(asset.id),value:asset}]);return result;
  }catch(e){workError=e;throw e;}},r=>({original:originalRef(asset),automatic:true,reviewRequired:false,kind:r.kind,characters:r.value.text.length,textStateHash:stateHash(r.value.text),...(r.kind==='ocr'?{processor:r.value.processor,modelFiles:r.value.modelFiles,language:r.value.language,image:r.value.image,regions:r.value.regions.length}:r.kind==='pdf'?{processor:r.value.processor,totalPages:r.value.totalPages,pagesRead:r.value.pages.length,ocrPages:r.value.pages.filter(p=>p.ocr).map(p=>({page:p.page,...p.ocr})),coverage:r.value.status}:{model:r.value.model,language:r.value.language,durationMs:r.value.durationMs,segments:r.value.segments.length,scope:asset.kind==='video'?'video-audio':'audio'})}));
  check();return {reading,status:readingStatus(reading,false)};
 }catch(e){check();if(e!==workError)throw e;return {status:(e as Error).message||'Reading failed'};}
}
