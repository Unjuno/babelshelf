// @ts-expect-error Shared canonical source validator.
import {validateRefs} from '../../../dist/core.js';

/** Archival byte proof only. Withdrawal must not erase historical references;
 * this projection never makes a record eligible for current model evidence. */
export function validateHistoricalSourceRefs(notes:any[],refs:unknown){
 if(!Array.isArray(refs))throw Error('Invalid backup source reference');
 if(refs.length&&!validateRefs(notes.map(note=>({...note,state:'active'})),refs).ok)throw Error('Invalid backup source reference');
}
