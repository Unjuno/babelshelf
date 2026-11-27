import type {Transcript} from './speech-transcript.ts';

export type AudioRange={startMs:number;endMs:number;label:string;seekable?:true};
const time=(ms:number)=>{const ticks=Math.round(ms/100);return String(Math.floor(ticks/600)).padStart(2,'0')+':'+((ticks%600)/10).toFixed(1).padStart(4,'0');};
export function transcriptCitationRange(t:Transcript,body:string,revision:number,start:number,end:number,citedQuote?:string):AudioRange {
 if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<=start||end>body.length)throw Error('Source range invalid');
 if(t.sourceTrack==='video-audio'&&!t.containerTiming)return {startMs:0,endMs:t.durationMs,label:'Whole video · audio timing not mapped'};
 const whole=(reason:string)=>({startMs:0,endMs:t.durationMs,label:(t.sourceTrack==='video-audio'?'Whole video':'Whole recording')+' · '+reason});
 if(revision!==1||body!==t.text)return whole('edited transcript');
 const excerpt=body.slice(start,end),at=citedQuote?excerpt.indexOf(citedQuote):-1;
 if(citedQuote&&at>=0&&excerpt.indexOf(citedQuote,at+1)<0){start+=at;end=start+citedQuote.length;}
 let cursor=0;const selected:Transcript['segments']=[];
 for(const s of t.segments){const at=body.indexOf(s.text,cursor);if(at<0)return whole('timing unavailable');cursor=at+s.text.length;if(at<end&&cursor>start)selected.push(s);}
 if(!selected.length)return whole('timing unavailable');
 const startMs=Math.min(...selected.map(s=>s.startMs)),endMs=Math.max(...selected.map(s=>s.endMs));
 if(!Number.isInteger(startMs)||!Number.isInteger(endMs)||startMs<0||endMs<=startMs||endMs>t.durationMs)throw Error('Audio range invalid');
 if(t.containerTiming){const offset=t.containerTiming.startUs/1000,mappedStart=offset+startMs,mappedEnd=Math.min(t.containerTiming.endUs/1000,offset+endMs);return {startMs:mappedStart,endMs:mappedEnd,label:'Estimated · '+time(mappedStart)+'–'+time(mappedEnd),seekable:true};}
 return {startMs,endMs,label:'Estimated · '+time(startMs)+'–'+time(endMs)};
}
