import type {NoteView} from './knowledge-store.ts';
import {taskRunView} from './task-records.ts';
export function executionAtRevision(notes:NoteView[],id:string,revision?:number){
 const note=notes.find(n=>n.id===id&&n.recordType==='execution');if(!note)return undefined;
 const version=revision??note.version;if(!Number.isInteger(version)||version<1||version>note.version)throw Error('Execution revision unavailable');
 const body=version===note.version?note.body:note.history[version-1];if(typeof body!=='string')throw Error('Execution revision unavailable');
 return {...taskRunView({ui:{recordType:'execution'},revisions:[{version,body}]}),id,version,path:note.paths?.[version-1]??note.path};
}
