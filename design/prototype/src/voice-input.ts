import {validateTranscript,type Transcript} from './speech-transcript.ts';
import {originalKey,type OriginalAsset} from './original-assets.ts';
import type {Dialogue} from './conversation.ts';
import type {VoiceInput} from './voice-input-contract.ts';
export function voicePrompt(draft:string,t:Transcript){if(!t.text?.trim())throw Error('Voice text unavailable');return draft+(draft&&!draft.endsWith('\n')?'\n':'')+t.text;}
export function bindVoice(t:Transcript,user:string):VoiceInput {const start=user.indexOf(t.text),unique=start>=0&&user.indexOf(t.text,start+1)<0;return {schema:1,transcript:structuredClone(t),prompt:unique?{start,end:start+t.text.length}:null};}
export function validateVoiceInputs(dialogue:Dialogue|undefined,runs:{key:string;value:any}[]){
 for(const turn of dialogue?.turns??[])for(const a of turn.attachments??[])if(a.voice){
  const v=a.voice,asset=runs.find(r=>r.key===originalKey(a.asset?.id??''))?.value as OriginalAsset;
  if(!asset||!a.asset||v.schema!==1||v.transcript?.original?.id!==a.asset.id||v.transcript.original.sha256!==a.asset.sha256||v.transcript.original.revision!==a.asset.revision)throw Error('Voice original unavailable');validateTranscript(v.transcript,asset);
  if(v.prompt!==null&&(!v.prompt||!Number.isInteger(v.prompt.start)||!Number.isInteger(v.prompt.end)||v.prompt.start<0||v.prompt.end>turn.user.length||v.prompt.end<=v.prompt.start||turn.user.slice(v.prompt.start,v.prompt.end)!==v.transcript.text))throw Error('Voice prompt range invalid');
 }
}
