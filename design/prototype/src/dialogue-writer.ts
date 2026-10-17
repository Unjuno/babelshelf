import type {Dialogue} from './conversation.ts';
// One local serialization boundary; IDB still enforces the cross-tab expected value.
// Functional updates are narrowly authored by the harness, never supplied by a model.
export function createDialogueWriter(read:()=>Dialogue,write:(next:Dialogue)=>Promise<void>){
 let tail=Promise.resolve();
 const update=(change:(current:Dialogue)=>Dialogue)=>{
  tail=tail.then(async()=>{const current=read(),next=change(current);if(next!==current)await write(next);});return tail;
 };
 return {update,settled:()=>tail,replace(next:Dialogue){
  const expected=read();return update(current=>{if(current!==expected)throw Error('Conversation changed locally · reopen to continue');return next;});
 }};
}
