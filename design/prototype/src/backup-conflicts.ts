import type {RestoreConflict} from './backup-state.ts';
import {PENDING_CORRECTION_KEY} from './pending-correction.ts';

export function restoreConflictLabel(conflict:RestoreConflict){
 if(conflict.store==='notes')return conflict.label;
 if(conflict.store==='runs')return 'History';
 return ({'ui-v1-dialogue':'Messages','ui-v1-folders':'Folders','ui-v1-trash':'Trash',[PENDING_CORRECTION_KEY]:'Pending changes'} as Record<string,string>)[conflict.key]??'Settings';
}
