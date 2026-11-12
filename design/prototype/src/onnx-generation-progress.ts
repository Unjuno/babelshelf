import {LogitsProcessor} from '@huggingface/transformers';

/** Transformers calls logits processors after each actual forward pass. Only
 * that work can report liveness; no tokens, scores or timer heartbeats escape.
 */
export class OnnxGenerationProgress extends LogitsProcessor {
 private check:()=>void;
 private progress:(value:string)=>void;
 private now:()=>number;
 private lastProgressAt:number|undefined;
 constructor(check:()=>void,progress:(value:string)=>void,now=()=>performance.now()){
  super();this.check=check;this.progress=progress;this.now=now;
 }
 _call(_ids:bigint[][],logits:any){
  this.check();const now=this.now();
  if(this.lastProgressAt===undefined||now-this.lastProgressAt>=1000){this.lastProgressAt=now;this.progress('Generating tokens');}
  return logits;
 }
}
