import {textAssetInput} from './asset-activity.ts';
import type {CustomLocalModel} from './preference-records.ts';

export function selectedTextFileGuidance(modelId:string,customModels:readonly CustomLocalModel[]=[]):string {
 if(!modelId)return 'Select a text model first.';
 try{
  const {model}=textAssetInput(modelId,false,undefined,[...customModels]);
  if(model.format==='GGUF'||('file' in model&&/\.gguf$/i.test(model.file?.name??'')))return 'Have this model’s GGUF? Import it here with any required runtime file. The tokenizer is inside; Prepare downloads verified files.';
  if(model.format==='ONNX')return 'Have the ONNX weights, config and tokenizer files? Import them here; Prepare downloads verified files.';
 }catch{/* An unknown selection must not be presented as an importable package. */}
 return 'No compatible import package for this selection.';
}

export function mediaReadingStatus(input:{ocrSelected:boolean;ocrReady:boolean;visionSelected:boolean;visionReady:boolean;speechStatus:string}){
 const state=(selected:boolean,ready:boolean)=>!selected?'off':ready?'files verified':'not prepared';
 const speech=input.speechStatus==='Ready'?'files verified':input.speechStatus==='Speech model required'?'off':input.speechStatus==='Speech model not prepared'?'not prepared':input.speechStatus;
 return {
  pdf:'Text layer ready · Scanned pages: OCR '+state(input.ocrSelected,input.ocrReady),
  image:'OCR '+state(input.ocrSelected,input.ocrReady)+' · Image understanding '+state(input.visionSelected,input.visionReady),
  audio:'Transcription '+speech,
  video:'Playback ready · Audio transcription '+speech+' · Frames unavailable',
 };
}
