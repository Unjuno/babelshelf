import {textAssetInput} from './asset-activity.ts';
import type {CustomLocalModel} from './preference-records.ts';

export function selectedTextFileGuidance(modelId:string,customModels:readonly CustomLocalModel[]=[]):string {
 if(!modelId)return 'Choose a model before importing its files.';
 try{
  const {model}=textAssetInput(modelId,false,undefined,[...customModels]);
  if(model.format==='GGUF'||('file' in model&&/\.gguf$/i.test(model.file?.name??'')))return 'For this selected model: matching GGUF with tokenizer and chat template inside; pinned runtime file if required. Files are verified locally. No new model is added.';
  if(model.format==='ONNX')return 'For this selected model: matching ONNX weights, config and tokenizer files. Files are verified locally. No new model is added.';
 }catch{/* An unknown selection must not be presented as an importable package. */}
 return 'No compatible import package for this selection.';
}

export function mediaReadingStatus(input:{ocrSelected:boolean;ocrReady:boolean;visionSelected:boolean;visionReady:boolean;speechStatus:string}){
 const state=(selected:boolean,ready:boolean)=>!selected?'model not selected':ready?'files verified':'not prepared';
 const speech=input.speechStatus==='Ready'?'files verified':input.speechStatus==='Speech model required'?'model not selected':input.speechStatus==='Speech model not prepared'?'not prepared':input.speechStatus;
 return {
  pdf:'Text layer: ready · Scanned pages: OCR '+state(input.ocrSelected,input.ocrReady),
  image:'Text: OCR '+state(input.ocrSelected,input.ocrReady)+' · Description: '+state(input.visionSelected,input.visionReady),
  audio:'Speech to text: '+speech,
  video:'Playback: ready · Audio transcription: '+speech,
 };
}
