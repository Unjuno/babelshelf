import {validateTranscript,type Transcript} from './speech-transcript.ts';
import {originalKey,type OriginalAsset} from './original-assets.ts';
import type {Dialogue} from './conversation.ts';
export type VoiceInput={schema:1;transcript:Transcript;prompt:{start:number;end:number}|null};
export type AudioRange={startMs:number;endMs:number;label:string};
export function voicePrompt(draft:string,t:Transcript){if(!t.text?.trim())throw Error('Voice text unavailable');return draft+(draft&&!draft.endsWith('\n')?'\n':'')+t.text;}
export function bindVoice(t:Transcript,user:string):VoiceInput {const start=user.indexOf(t.text),unique=start>=0&&user.indexOf(t.text,start+1)<0;return {schema:1,transcript:structuredClone(t),prompt:unique?{start,end:start+t.text.length}:null};}
export function validateVoiceInputs(dialogue:Dialogue|undefined,runs:{key:string;value:any}[]){
 for(const turn of dialogue?.turns??[])for(const a of turn.attachments??[])if(a.voice){
  const v=a.voice,asset=runs.find(r=>r.key===originalKey(a.asset?.id??''))?.value as OriginalAsset;
  if(!asset||!a.asset||v.schema!==1||v.transcript?.original?.id!==a.asset.id||v.transcript.original.sha256!==a.asset.sha256||v.transcript.original.revision!==a.asset.revision)throw Error('Voice original unavailable');validateTranscript(v.transcript,asset);
  if(v.prompt!==null&&(!v.prompt||!Number.isInteger(v.prompt.start)||!Number.isInteger(v.prompt.end)||v.prompt.start<0||v.prompt.end>turn.user.length||v.prompt.end<=v.prompt.start||turn.user.slice(v.prompt.start,v.prompt.end)!==v.transcript.text))throw Error('Voice prompt range invalid');
 }
}
const time=(ms:number)=>{const ticks=Math.round(ms/100);return String(Math.floor(ticks/600)).padStart(2,'0')+':'+((ticks%600)/10).toFixed(1).padStart(4,'0');};
export function transcriptCitationRange(t:Transcript,body:string,revision:number,start:number,end:number,citedQuote?:string):AudioRange {
 if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<=start||end>body.length)throw Error('Source range invalid');
 if(t.sourceTrack==='video-audio')return {startMs:0,endMs:t.durationMs,label:'Whole video · audio timing not mapped'};
 const whole=(reason:string)=>({startMs:0,endMs:t.durationMs,label:'Whole recording · '+reason});
 if(revision!==1||body!==t.text)return whole('edited transcript');
 const excerpt=body.slice(start,end),at=citedQuote?excerpt.indexOf(citedQuote):-1;
 if(citedQuote&&at>=0&&excerpt.indexOf(citedQuote,at+1)<0){start+=at;end=start+citedQuote.length;}
 let cursor=0;const selected:Transcript['segments']=[];
 for(const s of t.segments){const at=body.indexOf(s.text,cursor);if(at<0)return whole('timing unavailable');cursor=at+s.text.length;if(at<end&&cursor>start)selected.push(s);}
 if(!selected.length)return whole('timing unavailable');
 const startMs=Math.min(...selected.map(s=>s.startMs)),endMs=Math.max(...selected.map(s=>s.endMs));
 if(!Number.isInteger(startMs)||!Number.isInteger(endMs)||startMs<0||endMs<=startMs||endMs>t.durationMs)throw Error('Audio range invalid');
 return {startMs,endMs,label:'Estimated · '+time(startMs)+'–'+time(endMs)};
}
