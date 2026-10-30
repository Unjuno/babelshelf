import type {Dialogue,SourceRef} from './conversation.ts';
import {GroundingConflictError} from './grounding-conflict.ts';
import type {SourceMetadataGuard} from './note-provenance.ts';
// One local serialization boundary; IDB still enforces the cross-tab expected value.
// Functional updates are narrowly authored by the harness, never supplied by a model.
export function createDialogueWriter(read:()=>Dialogue,write:(next:Dialogue,refs?:SourceRef[],metadata?:SourceMetadataGuard[])=>Promise<void>){
 let tail=Promise.resolve();
 const update=(change:(current:Dialogue)=>Dialogue,refs?:SourceRef[],metadata?:SourceMetadataGuard[])=>{
  const sources=refs?structuredClone(refs):undefined,guards=metadata?structuredClone(metadata):undefined;
  const result=tail.then(async()=>{const current=read(),next=change(current);if(next!==current)await write(next,sources,guards);});
  tail=result.catch(error=>{if(!(error instanceof GroundingConflictError))throw error;});
  // Keep genuine failures on the queue for settled()/later callers without an
  // unhandled rejection when the original caller observes only `result`.
  void tail.catch(()=>{});return result;
 };
 return {update,settled:()=>tail,replace(next:Dialogue){
  const expected=read();return update(current=>{if(current!==expected)throw Error('Conversation changed locally · reopen to continue');return next;});
 }};
}
