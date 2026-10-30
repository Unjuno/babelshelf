import type {ReplyStyle} from './reply-style.ts';
import type {HarnessProfile} from './preference-records.ts';

export type TurnExecutionSnapshot=Readonly<{
 schema:1;
 turnId:string;
 models:Readonly<{
  text:Readonly<{id:string;revision:string|null;runtimeRevision:string}>;
  decision:Readonly<{id:string;revision:string|null}>;
  speech:string;
  ocr:string;
  vision:string;
 }>;
 harness:Readonly<{profileId:string;enabledTools:readonly string[];maxToolCalls:number|null;maxResultChars:number}>;
 response:Readonly<{style:ReplyStyle;userGuidance:string}>;
 attachments:readonly Readonly<{id:string;kind:string;status:string;asset?:Readonly<{id:string;revision:1;sha256:string}>;reading?:Readonly<{kind:string;noteId:string;revision:number}>}>[];
}>;

function textIdentity(id:string,manifest:{models:{id:string;revision:string;runtime?:{revision:string}}[];runtime:{revision:string}}){
 const model=manifest.models.find(item=>item.id===id);
 return Object.freeze({id,revision:model?.revision??null,runtimeRevision:model?.runtime?.revision??manifest.runtime.revision});
}

/** Freeze the user- and runtime-selected inputs that define one Send operation.
 * This is ephemeral execution metadata; it never stores prompt or note contents. */
export function captureTurnExecutionSnapshot(input:{
  turnId:string;
  textModel:string;
  textManifest:{models:{id:string;revision:string;runtime?:{revision:string}}[];runtime:{revision:string}};
  decisionModel:string;
  decisionIdentity:{model:string;revision:string};
  speechModel:string;
  ocrModel:string;
  visionModel:string;
  profile:HarnessProfile;
  replyStyle:ReplyStyle;
  userGuidance:string;
  attachments:readonly {id:string;kind:string;status:string;asset?:{id:string;revision:1;sha256:string};reading?:{kind:string;noteId:string;revision:number}}[];
}):TurnExecutionSnapshot{
 if(typeof input.turnId!=='string'||!input.turnId||input.turnId.length>128)throw Error('Invalid turn identity');
 if(!input.profile||!Array.isArray(input.profile.enabledTools)||(input.profile.maxToolCalls!==null&&!Number.isSafeInteger(input.profile.maxToolCalls))||!Number.isSafeInteger(input.profile.maxResultChars))throw Error('Invalid active harness profile');
 const attachments=input.attachments.map(item=>{
  if(!item||typeof item.id!=='string'||!item.id||typeof item.kind!=='string'||typeof item.status!=='string')throw Error('Invalid turn attachment identity');
  return Object.freeze({id:item.id,kind:item.kind,status:item.status,...(item.asset?{asset:Object.freeze({...item.asset})}:{}),...(item.reading?{reading:Object.freeze({...item.reading})}:{})});
 });
 return Object.freeze({
  schema:1 as const,
  turnId:input.turnId,
  models:Object.freeze({
   text:textIdentity(input.textModel,input.textManifest),
   decision:Object.freeze({id:input.decisionModel,revision:input.decisionIdentity.model===input.decisionModel?input.decisionIdentity.revision:null}),
   speech:input.speechModel,ocr:input.ocrModel,vision:input.visionModel,
  }),
  harness:Object.freeze({profileId:input.profile.id,enabledTools:Object.freeze([...input.profile.enabledTools]),maxToolCalls:input.profile.maxToolCalls,maxResultChars:input.profile.maxResultChars}),
  response:Object.freeze({style:input.replyStyle,userGuidance:input.userGuidance}),
  attachments:Object.freeze(attachments),
 });
}

/** Safe-to-record identity: excludes the prompt, guidance, filenames and source text. */
export function turnExecutionReceipt(snapshot:TurnExecutionSnapshot){
 return Object.freeze({turnId:snapshot.turnId,textModel:snapshot.models.text.id,textRevision:snapshot.models.text.revision,textRuntimeRevision:snapshot.models.text.runtimeRevision,decisionModel:snapshot.models.decision.id,decisionRevision:snapshot.models.decision.revision,harnessProfileId:snapshot.harness.profileId,configuredToolIds:Object.freeze([...snapshot.harness.enabledTools]),attachmentCount:snapshot.attachments.length});
}
