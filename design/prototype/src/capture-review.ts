import {completeTurn,type Dialogue} from './conversation.ts';
export const CAPTURE_REVIEW_STATUS='Review before saving';
/** Only acknowledge cancellation of this exact still-pending capture. A newer
 * saved/failed outcome, originals, source pins and other turns stay untouched. */
export function cancelCaptureReview(dialogue:Dialogue,turnId:string):Dialogue{
 if(dialogue.turns.find(turn=>turn.id===turnId)?.status!==CAPTURE_REVIEW_STATUS)return dialogue;
 return completeTurn(dialogue,turnId,{status:'Save cancelled'});
}
