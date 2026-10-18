// Capture lifecycle only. Completion supplies local bytes, never recognition results.
export function startRecording(recorder:MediaRecorder,callbacks:{complete:(audio:Blob)=>void;error:(message:string)=>void},limitMs=120000):()=>void{
 let settled=false;const parts:BlobPart[]=[];
 let timer:ReturnType<typeof setTimeout>|undefined;
 const release=()=>{
  if(timer!==undefined)clearTimeout(timer);
  recorder.ondataavailable=null;recorder.onstop=null;recorder.onerror=null;
  if(recorder.state!=='inactive')try{recorder.stop();}catch{}
  for(const track of recorder.stream.getTracks())track.stop();
 };
 const cancel=()=>{if(settled)return;settled=true;parts.length=0;release();};
 const fail=(message:string)=>{if(settled)return;cancel();callbacks.error(message);};
 recorder.ondataavailable=event=>{if(!settled&&event.data.size)parts.push(event.data);};
 recorder.onerror=event=>fail((event as Event&{error?:DOMException}).error?.message||'Recording failed');
 recorder.onstop=()=>{
  if(settled)return;
  let audio:Blob;try{audio=new Blob(parts,{type:recorder.mimeType});}catch{fail('Recording failed');return;}
  if(!audio.size){fail('No audio recorded');return;}
  cancel();callbacks.complete(audio);
 };
 timer=setTimeout(()=>{if(!settled&&recorder.state!=='inactive')try{recorder.stop();}catch{fail('Recording failed');}},limitMs);
 try{recorder.start();}catch(error){cancel();throw error;}
 return cancel;
}
