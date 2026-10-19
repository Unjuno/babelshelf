export function selectedTextFileGuidance(modelId:string,custom:boolean):string {
 if(!modelId)return 'Select a text model first.';
 if(custom||['4B','2B','9B'].includes(modelId))return 'GGUF includes tokenizer data. Import matches this selected model; some models also need a compatible runtime file.';
 return 'Import the ONNX weights, config and tokenizer files for this selected model.';
}

export function mediaReadingStatus(input:{ocrSelected:boolean;ocrReady:boolean;visionSelected:boolean;visionReady:boolean;speechStatus:string}){
 const state=(selected:boolean,ready:boolean)=>!selected?'Model off':ready?'Files verified':'Not prepared';
 const speech=input.speechStatus==='Ready'?'Files verified':input.speechStatus;
 return {
  pdf:'Text layer ready · Scanned pages: OCR '+state(input.ocrSelected,input.ocrReady),
  image:'OCR '+state(input.ocrSelected,input.ocrReady)+' · Image understanding '+state(input.visionSelected,input.visionReady),
  audio:'Transcription '+speech,
  video:'Playback ready · Audio '+speech+' · Frames unavailable',
 };
}
