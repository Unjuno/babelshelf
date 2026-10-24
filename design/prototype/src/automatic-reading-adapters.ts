import {makeVisionText} from './vision-text.ts';
import {readOriginal,type OriginalAsset} from './original-assets.ts';
import {speechModelProvenance} from './speech-models.ts';
import {transcribeOriginal} from './speech-input.ts';
import type {Transcript} from './speech-transcript.ts';
import type {VisionText} from './vision-text.ts';
import type {OcrText} from './ocr-text.ts';
import type {PdfText} from './pdf-text.ts';
import type {OcrLanguage} from './ocr-assets.ts';
import type {CustomSpeechModel} from './preference-records.ts';
import type {ReadingAdapters} from './automatic-reading.ts';

type RuntimeRole='vision'|'speech'|'ocr'|'pdf';
type VisionObservation={model:string;revision:string;runtime:string;text:string;width:number;height:number};
type VideoReader=typeof import('./video-vision.ts')['describeVideoOriginal'];
type OcrReader=typeof import('./ocr-engine.ts')['extractImageText'];
type PdfReader=typeof import('./pdf-engine.ts')['extractPdf'];
type TranscribeOriginal=typeof transcribeOriginal;

export type AutomaticReadingAdapterPorts={
 prompt:string;
 ocrModel:string;
 ocrReady:boolean;
 ocrLanguage:OcrLanguage;
 speechModel:string;
 speechReady:boolean;
 speechLanguage:string;
 customSpeechModels:readonly CustomSpeechModel[];
 ensureRuntime:(role:RuntimeRole,allowNetwork:false)=>Promise<void>;
 releaseInference:(signal:AbortSignal)=>Promise<void>;
 vision:{
  describe:(image:Blob,prompt:string)=>Promise<VisionObservation>;
  describeFrames:(images:Blob[],prompt:string)=>Promise<{frames:VisionObservation[]}>;
 };
 transcribe:(samples:Float32Array,language:string)=>Promise<unknown>;
 loadVideoReader?:()=>Promise<{describeVideoOriginal:VideoReader}>;
 loadOcrReader?:()=>Promise<{extractImageText:OcrReader}>;
 loadPdfReader?:()=>Promise<{extractPdf:PdfReader}>;
 transcribeOriginal?:TranscribeOriginal;
 readOriginal?:(asset:OriginalAsset)=>Uint8Array;
};

/**
 * Binds a Send-time reading policy to local runtimes and source-preserving
 * media readers. Capability selection and processing receipts remain owned by
 * readInputOriginal; this factory only adapts the selected operation.
 */
export function createAutomaticReadingAdapters(ports:AutomaticReadingAdapterPorts):ReadingAdapters{
 const original=ports.readOriginal??readOriginal;
 const transcribe=ports.transcribeOriginal??transcribeOriginal;
 const ensure=async(role:RuntimeRole,signal:AbortSignal)=>{
  signal.throwIfAborted();
  await ports.ensureRuntime(role,false);
  signal.throwIfAborted();
 };
 const transcribeAsset=(asset:OriginalAsset,signal:AbortSignal)=>transcribe(
  asset,
  ports.speechLanguage,
  signal,
  ports.transcribe,
  speechModelProvenance(ports.speechModel,ports.customSpeechModels),
 );
 const releaseInference=async(signal:AbortSignal)=>{
  signal.throwIfAborted();
  await ports.releaseInference(signal);
  signal.throwIfAborted();
 };

 return {
  vision:async(asset,signal,progress):Promise<VisionText>=>{
   await ensure('vision',signal);
   const prompt=ports.prompt.trim()||'Describe visible image content.';
   if(asset.kind==='video'){
    const {describeVideoOriginal}=await (ports.loadVideoReader??(()=>import('./video-vision.ts')))();
    signal.throwIfAborted();
    return describeVideoOriginal(asset,prompt,signal,progress,{
     describe:ports.vision.describeFrames,
     audio:{
      selected:!!ports.speechModel,
      ready:ports.speechReady,
      read:async()=>{
       await ensure('speech',signal);
       return transcribeAsset(asset,signal);
      },
     },
    });
   }
   const result=await ports.vision.describe(new Blob([original(asset).slice().buffer],{type:asset.mime}),prompt);
   signal.throwIfAborted();
   return makeVisionText(asset,{...result,prompt});
  },
  ocr:async(asset,signal,progress):Promise<OcrText>=>{
   await releaseInference(signal);
   await ensure('ocr',signal);
   const {extractImageText}=await (ports.loadOcrReader??(()=>import('./ocr-engine.ts')))();
   signal.throwIfAborted();
   return extractImageText(asset,ports.ocrLanguage,signal,progress);
  },
  pdf:async(asset,signal,progress):Promise<PdfText>=>{
   await ensure('pdf',signal);
   const useOcr=ports.ocrModel==='tesseract-7'&&ports.ocrReady;
   if(useOcr)await ensure('ocr',signal);
   const {extractPdf}=await (ports.loadPdfReader??(()=>import('./pdf-engine.ts')))();
   signal.throwIfAborted();
   const ocr=useOcr?{
    language:ports.ocrLanguage,
    progress,
    beforeOcr:()=>releaseInference(signal),
   }:undefined;
   return extractPdf(asset,signal,(page,total)=>progress('Reading · '+page+' / '+total),ocr);
  },
  speech:async(asset,signal):Promise<Transcript>=>{
   await ensure('speech',signal);
   return transcribeAsset(asset,signal);
  },
 };
}
