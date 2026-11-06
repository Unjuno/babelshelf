import {appendTurn,INTERRUPTED_TURN_STATUS,type Dialogue} from './conversation.ts';
import {prepareOriginal,readOriginal,originalRef,originalText,checkAttachmentBatch,type OriginalAsset,type OriginalRef,type OriginalKind} from './original-assets.ts';
import {readingRef,readingStatus,type ReviewedText,type InputReadingRef} from './input-readings.ts';
import {bindVoice,type VoiceInput} from './voice-input.ts';
import {recoverSubmittedInput} from './input-recovery.ts';

export type SubmissionAttachment={id:string;name:string;kind:OriginalKind;size:number;status:string;asset?:OriginalRef;file?:File;prepared?:OriginalAsset;reviewedText?:ReviewedText;reading?:InputReadingRef;voice?:VoiceInput};
type Sent<T extends SubmissionAttachment>=Omit<T,'file'|'prepared'|'reviewedText'>&{asset:OriginalRef};
type Snapshot={prior:Dialogue;expected:Dialogue|undefined};
export type SubmissionPorts<T extends SubmissionAttachment,R>={
 snapshot:()=>Promise<Snapshot>;
 original:(ref:OriginalRef)=>Promise<OriginalAsset>;
 read:(asset:OriginalAsset,item:T)=>Promise<{status:string;reading?:ReviewedText}>;
 commit:(value:Snapshot&{next:Dialogue;originals:OriginalAsset[];readings:ReviewedText[]})=>Promise<R>;
};

/** One attempt owns preparation and the commit boundary, never UI or inference.
 * Cancellation cannot roll back a completed storage transaction. Keep its receipt
 * even when Stop occurs during commit; callers must adopt it before continuing.
 */
export function createInputSubmission<T extends SubmissionAttachment>(id:string,text:string,attachments:T[],check:()=>void){
 const items=attachments.map(item=>({...item}));
 let started=false,committed:{text:string;attachments:Sent<T>[]} | null=null;
 return {
  get committed(){return committed;},
  recover(current:{text:string;attachments:unknown[]}){return recoverSubmittedInput(current,committed);},
  async run<R>(ports:SubmissionPorts<T,R>){
   if(started)throw Error('Input already submitted');started=true;
   check();checkAttachmentBatch(items);
   const snapshot=await ports.snapshot();check();
   const originals:OriginalAsset[]=[],raw=new Map<string,OriginalAsset>(),automatic=new Set<string>();
   for(const item of items){
    check();const value=item.prepared??(item.file?await prepareOriginal(item.file,item.id):item.asset?await ports.original(item.asset):undefined);
    check();if(!value)throw Error('Original unavailable');readOriginal(value,item.asset);raw.set(item.id,value);
    if(item.prepared||item.file)originals.push(value);
   }
   for(const item of items){
    check();const asset=raw.get(item.id)!;
    if(item.reading||item.reviewedText||item.voice||originalText(asset).status==='Text available')continue;
    const result=await ports.read(asset,item);check();item.status=result.status;
    if(result.reading){item.reviewedText=result.reading;automatic.add(item.id);}
   }
   const sent=items.map(item=>{
    const {file,prepared,reviewedText,...rest}=item;
    return {...rest,asset:originalRef(raw.get(item.id)!),...(item.voice?{voice:bindVoice(item.voice.transcript,text)}:{}),...(reviewedText?{reading:readingRef(reviewedText)}:{}),
     status:reviewedText?readingStatus(reviewedText,!automatic.has(item.id)):item.voice?(item.kind==='video'?'Audio transcript reviewed · frames not processed':'Transcript reviewed'):originalText(raw.get(item.id)!).status==='Text available'?'Text available':item.status};
   });
   const next=appendTurn(snapshot.prior,{id,user:text,status:INTERRUPTED_TURN_STATUS,attachments:sent.map(a=>({id:a.id,name:a.name,kind:a.kind,status:a.status,size:a.size,asset:a.asset,...(a.voice?{voice:a.voice}:{}),...(a.reading?{reading:a.reading}:{})}))});
   check();
   const saved=await ports.commit({...snapshot,next,originals,readings:items.flatMap(a=>a.reviewedText?[a.reviewedText]:[])});
   committed={text,attachments:sent};
   // No cancellation check here: callers need the acknowledged commit even on Stop.
   return {...snapshot,next,sent,saved};
  },
 };
}
