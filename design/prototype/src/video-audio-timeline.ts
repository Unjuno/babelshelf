export type VideoAudioTiming={schema:1;processor:'mediabunny-1.61.6';timebase:'container-presentation';trackId:number;startUs:number;endUs:number};
export function validateVideoAudioTiming(value:VideoAudioTiming,durationMs:number){
 if(!value||Object.keys(value).sort().join(',')!=='endUs,processor,schema,startUs,timebase,trackId'||value.schema!==1||value.processor!=='mediabunny-1.61.6'||value.timebase!=='container-presentation'||!Number.isSafeInteger(value.trackId)||value.trackId<1||!Number.isSafeInteger(value.startUs)||!Number.isSafeInteger(value.endUs)||value.startUs<0||value.endUs<=value.startUs||value.endUs-value.startUs>120000000||durationMs!==Math.ceil((value.endUs-value.startUs)/1000))throw Error('Transcript video timing invalid');
}
// Place decoded PCM on the container timeline, preserving gaps and clipping padding.
// Times are seconds; no concatenation that would remove delayed starts or silence.
export function createAudioTimeline(start:number,end:number,sampleRate:number){
 if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||end-start>120||!Number.isInteger(sampleRate)||sampleRate<1000||sampleRate>192000)throw Error('Video audio timing unavailable');
 const length=Math.ceil((end-start)*sampleRate-1e-7),samples=new Float32Array(length);
 let cursor=0,received=false;
 return {
  add(timestamp:number,channels:Float32Array[]){
   if(!Number.isFinite(timestamp)||!channels.length||channels.length>8||channels.some(c=>!(c instanceof Float32Array)||c.length!==channels[0].length))throw Error('Invalid decoded audio');
   const offset=Math.round((timestamp-start)*sampleRate);
   if(offset<cursor-1&&received)throw Error('Overlapping video audio samples');
   const from=Math.max(0,-offset,cursor-offset),to=Math.min(channels[0].length,length-offset);
   for(let i=from;i<to;i++){let sum=0;for(const c of channels){if(!Number.isFinite(c[i]))throw Error('Invalid decoded audio sample');sum+=c[i];}samples[offset+i]=sum/channels.length;}
   if(to>from){received=true;cursor=offset+to;}
  },
  finish(){if(!received)throw Error('Empty video audio');return samples;}
 };
}
