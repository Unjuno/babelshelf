import type {FormEvent,ReactNode} from 'react';
import {FolderSimple} from '@phosphor-icons/react';
import {KeyboardInput,KeyboardTextarea} from './mobile';

export type MemoryCreationMode='file'|'folder';
type RestoreConflict={id:string;disabled:boolean;onRestore:()=>void};

/** Presentation for creating a Memory file or folder. Storage policy stays with the caller. */
export function MemoryCreationSheet({mode,saving,ready,storagePending,canCreateFolder,name,content,location,depth,error,sourceControls,restoreConflicts,onModeChange,onNameChange,onContentChange,onSave,onCancel}:{
 mode:MemoryCreationMode;saving:boolean;ready:boolean;storagePending:boolean;canCreateFolder:boolean;
 name:string;content:string;location:string;depth:string;error:string;sourceControls:ReactNode;restoreConflicts:RestoreConflict[];
 onModeChange:(mode:MemoryCreationMode)=>void;onNameChange:(name:string)=>void;onContentChange:(content:string)=>void;
 onSave:()=>void;onCancel:()=>void;
}){
 function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();onSave();}
 return <form className="schedule-form creation-form schedule-form--task" onSubmit={submit}>
  <div className="task-fields">
   <div className="creation-types" role="tablist" aria-label="Create">
    <button type="button" role="tab" disabled={saving} aria-selected={mode==='file'} onClick={()=>onModeChange('file')}>File</button>
    <button type="button" role="tab" aria-selected={mode==='folder'} disabled={saving||!canCreateFolder} title={canCreateFolder?'New folder':'Maximum 5 folder levels'} onClick={()=>onModeChange('folder')}>Folder</button>
   </div>
   <div className="new-file-location"><FolderSimple size={17}/>{location}<span className="depth-count">{depth}</span></div>
   <label>Name<KeyboardInput disabled={saving} aria-label={mode==='file'?'File name':'Folder name'} placeholder={mode==='file'?'File name':'Folder name'} value={name} onChange={event=>onNameChange(event.target.value)}/></label>
   {mode==='file'&&sourceControls}
   {mode==='file'&&<label>Content<KeyboardTextarea disabled={saving} aria-label="New file content" placeholder="Write…" rows={4} value={content} onChange={event=>onContentChange(event.target.value)}/></label>}
   {error&&<div className="creation-error" role="alert">{error}</div>}
   {restoreConflicts.map(conflict=><button key={conflict.id} type="button" className="quiet-button" disabled={saving||conflict.disabled} onClick={conflict.onRestore}>Restore deleted file</button>)}
  </div>
  <div className="action-row"><button type="button" className="quiet-button" disabled={saving} onClick={onCancel}>Cancel</button><button type="submit" disabled={!ready||storagePending||saving} className="solid-button">Save</button></div>
 </form>;
}
