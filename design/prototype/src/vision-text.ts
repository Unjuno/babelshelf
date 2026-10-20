import {visionManifest} from './vision-assets.ts';
import {isOcrImage} from './ocr-text.ts';
import {readOriginal,originalRef,type OriginalAsset,type OriginalRef} from './original-assets.ts';
import {validateVideoVisionText,type VideoVisionText} from './video-observations.ts';
// @ts-expect-error Canonical notes are JavaScript.
import {createNote} from '../../../dist/core.js';

export type ImageVisionText={schema:1;model:string;revision:string;runtime:string;original:OriginalRef;prompt:string;text:string;width:number;height:number;scope:'single-image'};
export type VisionText=ImageVisionText|VideoVisionText;

export function makeVisionText(asset:OriginalAsset,input:{model:string;revision:string;runtime:string;prompt:string;text:string;width:number;height:number}):VisionText{
 const value:ImageVisionText={schema:1,...input,original:originalRef(asset),scope:'single-image'};validateVisionText(value,asset);return value;
}
export function validateVisionText(value:VisionText,asset:OriginalAsset){
 if(value?.scope==='sampled-video'){validateVideoVisionText(value,asset);return;}
 readOriginal(asset,value?.original);
 if(!isOcrImage(asset)||value?.schema!==1||value.model!==visionManifest.id||value.revision!==visionManifest.revision||value.runtime!==visionManifest.runtime||typeof value.prompt!=='string'||!value.prompt.trim()||value.prompt.length>2000||typeof value.text!=='string'||!value.text.trim()||value.text.length>50000||value.text.includes('\0')||!Number.isInteger(value.width)||!Number.isInteger(value.height)||value.width<1||value.height<1||value.width*value.height>64000000||value.scope!=='single-image')throw Error('Vision result metadata invalid');
}
export function visionTextNote(id:string,asset:OriginalAsset,value:VisionText){
 validateVisionText(value,asset);return {...createNote({path:'Attachments/Vision-'+id+'.md',title:asset.name+(value.scope==='sampled-video'?' · sampled video notes':' · image notes'),body:value.text}),id,mediaSource:originalRef(asset),visionText:structuredClone(value)};
}
export function validateVisionLinks(notes:any[],runs:{key:string;value:any}[]){
 for(const note of notes)if(note.visionText){const asset=runs.find(row=>row.value?.type==='original-asset'&&row.value.id===note.mediaSource?.id)?.value;if(!asset||note.ocrText||note.pdfText||note.transcription||note.originalAsset||note.id===asset.id)throw Error('Vision original unavailable');validateVisionText(note.visionText,asset);if(JSON.stringify(note.mediaSource)!==JSON.stringify(note.visionText.original)||note.revisions[0].body!==note.visionText.text)throw Error('Vision original text changed');}
}
