import {useState} from 'react';
import {canRestore,trashLocation} from './memory-trash';
import type {RecoveryBatch,NoteView} from './knowledge-store';

export function TrashSheet({trash,notes,folders,busy,onRestore,onPurge,onClose}:{trash:RecoveryBatch[];notes:NoteView[];folders:string[];busy:boolean;onRestore:(batch:RecoveryBatch)=>void;onPurge:(batches:RecoveryBatch[])=>Promise<false|{purged:number;retained:number}>;onClose:()=>void}){
 const [review,setReview]=useState<RecoveryBatch[]|null>(null);
 const [purgeResult,setPurgeResult]=useState<{purged:number;retained:number}|null>(null);
 const [purgeError,setPurgeError]=useState('');
 async function confirmPurge(){if(!review)return;setPurgeError('');try{const result=await onPurge(review);if(result){setReview(null);setPurgeResult(result.retained?result:null);}else setPurgeError('Items could not be deleted. Review the error, or close Trash and try again.');}catch(error){setPurgeError(error instanceof Error?error.message:'Items could not be deleted. Close Trash and try again.');}}
 if(review)return <div className="trash-purge-review">
  <h3>Delete permanently?</h3>
  <p>{review.length===1?review[0].label:`${review.length} entries in Trash`}</p>
  <p>This cannot be undone. Referenced entries stay in Trash; other selected entries can still be deleted.</p>
  {purgeError&&<p role="alert">{purgeError}</p>}
  <div className="action-row"><button className="quiet-button" disabled={busy} onClick={()=>{setPurgeError('');setReview(null);}}>Cancel</button><button className="solid-button danger-button" disabled={busy} onClick={()=>void confirmPurge()}>{busy?'Deleting…':'Delete permanently'}</button></div>
 </div>;
 return <div className="trash-list">{purgeResult&&<><p role="status">{purgeResult.purged?`${purgeResult.purged} ${purgeResult.purged===1?'entry':'entries'} deleted. `:'No entries deleted. '}{purgeResult.retained} referenced {purgeResult.retained===1?'entry was':'entries were'} kept in Trash to protect retained history or citations.</p><p>Schedule history can reference its schedule. To remove both, first delete the related notifications and execution files in Memory → Schedule → Runs, then empty Trash together. Other saved citations may still protect an entry.</p></>}{trash.length?trash.map(batch=><div className="notification-row" key={batch.id}>
  <div className="trash-item"><span>{batch.label}</span>{trashLocation(batch)&&<small>{trashLocation(batch)}</small>}<small>{batch.notes.length} {batch.notes.length===1?'file':'files'} · {batch.folders.length} {batch.folders.length===1?'folder':'folders'}</small>{!canRestore(batch,notes,folders)&&<small>Path conflict</small>}</div>
  <div className="trash-actions"><button className="quiet-button" aria-label={'Restore '+(trashLocation(batch)??batch.label)} disabled={busy||!canRestore(batch,notes,folders)} onClick={()=>onRestore(batch)}>Restore</button><button className="quiet-button danger-button" aria-label={'Delete permanently '+(trashLocation(batch)??batch.label)} disabled={busy} onClick={()=>setReview(structuredClone([batch]))}>Delete permanently</button></div>
 </div>):<div className="empty-state">Trash is empty</div>}
 <div className="action-row">{trash.length>0&&<button className="quiet-button danger-button" disabled={busy} onClick={()=>setReview(structuredClone(trash))}>Empty Trash</button>}<button className="quiet-button" disabled={busy} onClick={onClose}>Close</button></div></div>;
}
