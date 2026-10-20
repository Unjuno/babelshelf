import {validateVideoAudioTiming,type VideoAudioTiming} from './video-audio-timeline.ts';
import languages from './speech-languages.json' with {type:'json'};
import {speechModelProvenance,validSpeechModelProvenance} from './speech-models.ts';
import {readOriginal,originalRef,type OriginalAsset,type OriginalRef} from './original-assets.ts';
// @ts-expect-error Canonical baseline is JavaScript.
import {createNote} from '../../../dist/core.js';
export type Transcript={schema:1;containerTiming?:VideoAudioTiming;type:'audio-transcript';sourceTrack?:'video-audio';timebase?:'decoded-audio';timing:'model-estimated';language:string;original:OriginalRef;model:{id:string;revision:string;runtime:string;dtype:string};durationMs:number;coverage:{startMs:number;endMs:number};text:string;segments:{startMs:number;endMs:number;modelEndMs:number|null;text:string}[]};
export type SpeechModelProvenance=Transcript['model'];
export function makeTranscript(asset:OriginalAsset,durationMs:number,result:any,language='en',containerTiming?:VideoAudioTiming,model:SpeechModelProvenance=speechModelProvenance()):Transcript {
 const value:Transcript={schema:1,type:'audio-transcript',...(containerTiming?{containerTiming:structuredClone(containerTiming)}:{}),...(asset.kind==='video'?{sourceTrack:'video-audio' as const,timebase:'decoded-audio' as const}:{}),timing:'model-estimated',language,original:originalRef(asset),model:structuredClone(model),durationMs,coverage:{startMs:0,endMs:durationMs},text:result.text?.trim(),segments:(result.chunks??[]).map((c:any)=>({text:c.text?.trim(),startMs:Math.round(c.timestamp?.[0]*1000),modelEndMs:c.timestamp?.[1]===null?null:Math.round(c.timestamp?.[1]*1000),endMs:c.timestamp?.[1]===null?durationMs:Math.min(durationMs,Math.round(c.timestamp?.[1]*1000))}))};
 validateTranscript(value,asset);return value;
}
export function validateTranscript(t:Transcript,asset:OriginalAsset){
 if(!languages.includes(t?.language))throw Error('Transcript language invalid');
 readOriginal(asset,t.original);
 if(t.containerTiming!==undefined){if(asset.kind!=='video')throw Error('Transcript video timing invalid');validateVideoAudioTiming(t.containerTiming,t.durationMs);}
 if((asset.kind!=='audio'&&asset.kind!=='video')||(asset.kind==='video'?(t.sourceTrack!=='video-audio'||t.timebase!=='decoded-audio'):(t.sourceTrack!==undefined||t.timebase!==undefined))||t.schema!==1||t.type!=='audio-transcript'||t.timing!=='model-estimated'||!validSpeechModelProvenance(t.model)||!Number.isInteger(t.durationMs)||t.durationMs<=0||t.durationMs>120000||t.coverage?.startMs!==0||t.coverage?.endMs!==t.durationMs||typeof t.text!=='string'||!t.text.trim()||t.text.length>32000||!Array.isArray(t.segments)||!t.segments.length||t.segments.length>1000)throw Error('Transcript metadata invalid');
 let start=0;for(const s of t.segments){if(typeof s.text!=='string'||!s.text.trim()||!Number.isInteger(s.startMs)||!Number.isInteger(s.endMs)||s.startMs<start||s.endMs<=s.startMs||s.endMs>t.durationMs||(s.modelEndMs!==null&&(!Number.isInteger(s.modelEndMs)||s.modelEndMs>s.endMs+30000||s.modelEndMs<=s.startMs))||s.endMs!==Math.min(t.durationMs,s.modelEndMs??t.durationMs))throw Error('Transcript time range invalid');start=s.startMs;}
 if(t.segments.map(s=>s.text).join(' ').replace(/\s/g,'')!==t.text.replace(/\s/g,''))throw Error('Transcript segments mismatch');
}
export function transcriptNote(id:string,asset:OriginalAsset,t:Transcript){validateTranscript(t,asset);return {...createNote({path:'Attachments/Transcript-'+id+'.md',title:asset.name+' transcript',body:t.text}),id,mediaSource:originalRef(asset),transcription:structuredClone(t)};}
export function validateTranscriptLinks(notes:any[],runs:{key:string;value:any}[]){
 for(const n of notes)if(n.transcription||(n.mediaSource&&!n.pdfText&&!n.ocrText&&!n.visionText)){const asset=runs.find(r=>r.value?.type==='original-asset'&&r.value.id===n.mediaSource?.id)?.value;if(!asset)throw Error('Transcript original unavailable');validateTranscript(n.transcription,asset);if(JSON.stringify(n.mediaSource)!==JSON.stringify(n.transcription.original)||n.revisions[0].body!==n.transcription.text)throw Error('Transcript original text changed');}
}

// Describes provenance only; this grants neither source eligibility nor seek authority.
export function videoTimingCoverage(t:Transcript,body:string,revision:number):string {
 if(revision!==1||body!==t.text)return 'edited transcript; segment alignment unavailable';
 if(!t.containerTiming)return 'container timing unmapped';
 validateVideoAudioTiming(t.containerTiming,t.durationMs);
 return 'container timing mapped; segment timing estimated';
}
