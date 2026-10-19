import {textAssetInput} from './asset-activity.ts';
import type {CustomLocalModel} from './preference-records.ts';

export function selectedTextFileGuidance(modelId:string,customModels:readonly CustomLocalModel[]=[]):string {
 if(!modelId)return 'Choose a model before supplying its files.';
 try{
  const {model}=textAssetInput(modelId,false,undefined,[...customModels]);
  if(model.format==='GGUF'||('file' in model&&/\.gguf$/i.test(model.file?.name??'')))return 'Files for the selected model only. GGUF contains its tokenizer and chat template; a matching runtime file may also be required. This does not add or select a different model.';
  if(model.format==='ONNX')return 'Files for the selected model only. Supply matching ONNX weights, config and tokenizer files. This does not add or select a different model.';
 }catch{/* An unknown selection must not be presented as an importable package. */}
 return 'No compatible import package for this selection.';
}

export function selectedDecisionFileGuidance(custom:boolean):string {
 return custom
  ? 'Files for the selected custom D1 only: five matching ONNX, config and tokenizer files. This does not add a model.'
  : 'Files for the selected built-in D1 only: six pinned files, including ONNX weights, config, tokenizer and license. This does not add a model.';
}

export function mediaReadingStatus(input:{ocrSelected:boolean;ocrReady:boolean;visionSelected:boolean;visionReady:boolean;speechStatus:string}){
 const state=(selected:boolean,ready:boolean)=>!selected?'model not selected':ready?'files verified':'not prepared';
 const speech=input.speechStatus==='Ready'?'files verified':input.speechStatus==='Speech model required'?'model not selected':input.speechStatus==='Speech model not prepared'?'not prepared':input.speechStatus;
 return {
  pdf:['Text layer · ready','Scanned pages · OCR '+state(input.ocrSelected,input.ocrReady)],
  image:['Text · OCR '+state(input.ocrSelected,input.ocrReady),'Description · '+state(input.visionSelected,input.visionReady)],
  audio:['Transcription · '+speech],
  video:['Original preview · browser-dependent','Audio transcription · '+speech,'Frame understanding · unsupported'],
 };
}
