import {textAssetInput} from './asset-activity.ts';
import type {CustomLocalModel} from './preference-records.ts';

export function selectedTextFileGuidance(modelId:string,customModels:readonly CustomLocalModel[]=[]):string {
 if(!modelId)return 'Choose a model before supplying its files.';
 try{
  const {model}=textAssetInput(modelId,false,undefined,[...customModels]);
  if(model.format==='GGUF'||('file' in model&&/\.gguf$/i.test(model.file?.name??'')))return 'Selected model only · matching GGUF. Tokenizer and chat template are normally embedded; a matching runtime file may also be required. This does not add another model.';
  if(model.format==='ONNX')return 'Selected model only · matching ONNX weights, config and tokenizer files. This does not add or select a different model.';
 }catch{/* An unknown selection must not be presented as an importable package. */}
 return 'No compatible import package for this selection.';
}

export function selectedDecisionFileGuidance(custom:boolean,selected=true):string {
 if(!selected)return 'Choose a decision model before supplying its files.';
 return custom
  ? 'Custom D1 uses its verified ONNX, config and tokenizer package. Re-adding files opens a new model review; it cannot silently replace the selected model.'
  : 'Selected built-in D1 only · six pinned files including ONNX weights, config, tokenizer and license. This does not add a model.';
}

export function mediaReadingStatus(input:{ocrSelected:boolean;ocrReady:boolean;visionSelected:boolean;visionReady:boolean;speechStatus:string}){
 const state=(selected:boolean,ready:boolean)=>!selected?'model not selected':ready?'files verified':'not prepared';
 const speech=input.speechStatus==='Ready'?'files verified':input.speechStatus==='Speech model required'?'model not selected':input.speechStatus==='Speech model not prepared'?'not prepared':input.speechStatus;
 return {
  pdf:['Text layer · ready','Scanned pages · OCR '+state(input.ocrSelected,input.ocrReady)],
  image:['Text · OCR '+state(input.ocrSelected,input.ocrReady),'Description · '+state(input.visionSelected,input.visionReady)],
  audio:['Transcription · '+speech],
  video:['Original preview · browser-dependent','Audio track transcription · '+speech,'Video frames · no connected reader'],
 };
}
