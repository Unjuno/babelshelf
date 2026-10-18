import {Input,BlobSource,MP4,WEBM,AudioBufferSink} from 'mediabunny';
import {createAudioTimeline,validateVideoAudioTiming,type VideoAudioTiming} from './video-audio-timeline.ts';
// A local Blob and explicit formats exclude URL sources, playlists and fetch fallback.
// This decoder does not select arbitrarily between multiple audio tracks.
export async function decodeVideoAudio(blob:Blob,signal:AbortSignal){
 const check=()=>{if(signal.aborted)throw Error('Stopped');};check();
 if(blob.size>32*1024*1024)throw Error('File too large');
 const input=new Input({source:new BlobSource(blob),formats:[MP4,WEBM]});
 const abort=()=>input.dispose();signal.addEventListener('abort',abort,{once:true});
 try{
  const tracks=await input.getAudioTracks();check();
  if(tracks.length!==1)throw Error(tracks.length?'Multiple audio tracks · selection required':'No audio track');
  const track=tracks[0];if(!await track.canDecode())throw Error('Video audio codec unsupported');check();
  const start=await track.getFirstTimestamp(),end=await track.computeDuration();check();
  const rate=await track.getSampleRate(),channels=await track.getNumberOfChannels();check();
  if(channels<1||channels>8)throw Error('Video audio channels unsupported');
  const timeline=createAudioTimeline(start,end,rate),sink=new AudioBufferSink(track);
  for await(const {buffer,timestamp} of sink.buffers()){
   check();if(buffer.sampleRate!==rate||buffer.numberOfChannels!==channels)throw Error('Video audio format changed');
   timeline.add(timestamp,Array.from({length:channels},(_,i)=>buffer.getChannelData(i)));
  }
  check();const pcm=timeline.finish();
  const offline=new OfflineAudioContext(1,Math.ceil((end-start)*16000-1e-7),16000),buffer=offline.createBuffer(1,pcm.length,rate);
  buffer.copyToChannel(pcm,0);const node=offline.createBufferSource();node.buffer=buffer;node.connect(offline.destination);node.start();
  const mono=await offline.startRendering();check();
  const timing:VideoAudioTiming={schema:1,processor:'mediabunny-1.61.6',timebase:'container-presentation',trackId:track.id,startUs:Math.round(start*1e6),endUs:Math.round(end*1e6)};
  validateVideoAudioTiming(timing,Math.ceil((timing.endUs-timing.startUs)/1000));
  return {samples:mono.getChannelData(0),durationMs:Math.ceil((timing.endUs-timing.startUs)/1000),timing};
 }catch(e){check();throw e;}finally{signal.removeEventListener('abort',abort);input.dispose();}
}
