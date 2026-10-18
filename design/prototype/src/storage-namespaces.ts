// @ts-expect-error Shared baseline is plain JavaScript.
import {notePath} from '../../../dist/files.js';
export function assertFolderNamespace(records:any[],folders:string[]){for(const folder of folders){if(typeof folder!=='string')throw Error('Invalid folder data');const f=folder.toLowerCase();for(const note of records){const path=notePath(note).toLowerCase();if(f===path||f.startsWith(path+'/'))throw Error('File and folder paths collide');}}}
