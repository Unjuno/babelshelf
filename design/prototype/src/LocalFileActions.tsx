import {CaretRight} from '@phosphor-icons/react';

export function LocalFileActions({trashCount,backupBusy,backupPickerStatus,onTrash,onProcessingHistory,onExportBackup,onRestoreBackup,onBackupFile}:{trashCount:number;backupBusy:boolean;backupPickerStatus:string;onTrash:()=>void;onProcessingHistory:()=>void;onExportBackup:()=>void;onRestoreBackup:()=>void;onBackupFile:(file:File)=>void}){
 return <section aria-label="Local file actions">
  {backupPickerStatus&&<>
   <div className="sheet-operation-error" role="alert">{backupPickerStatus}</div>
   <label className="backup-file-selection">Backup file
    <input type="file" accept=".brainpack,application/json" disabled={backupBusy} onChange={event=>{
     const file=event.currentTarget.files?.[0];
     event.currentTarget.value='';
     if(file)onBackupFile(file);
    }}/>
   </label>
  </>}
  <button className="settings-action" aria-label="Trash" disabled={backupBusy} onClick={onTrash}><span>Trash{trashCount>0?' · '+trashCount:''}</span><CaretRight size={18}/></button>
  <button className="settings-action" disabled={backupBusy} onClick={onProcessingHistory}>Processing history<CaretRight size={18}/></button>
  <button className="settings-action" disabled={backupBusy} onClick={onExportBackup}>{backupBusy?'Preparing backup…':'Export backup'}<CaretRight size={18}/></button>
  <button className="settings-action" disabled={backupBusy} onClick={onRestoreBackup}>{backupBusy?'Checking backup…':'Restore backup'}<CaretRight size={18}/></button>
 </section>;
}
