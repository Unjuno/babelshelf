import {emptyDialogue,validateDialogue,type Dialogue} from './conversation.ts';
// User-requested read only. Drain both queues even if one failed; never replay.
export async function readDialogueRecovery(writers:Promise<unknown>[],load:()=>Promise<Dialogue|undefined>){
 await Promise.allSettled(writers);const stored=await load();
 return {stored,value:stored===undefined?emptyDialogue():validateDialogue(stored)};
}
