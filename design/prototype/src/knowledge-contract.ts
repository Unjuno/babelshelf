import type {SavedSourceRef} from './note-provenance.ts';
import type {DialogueCopy} from './dialogue-copy.ts';
import type {OriginalRef} from './original-assets.ts';

/** Application view of a saved knowledge record; storage owns its projection. */
export type NoteView={id:string;path:string;body:string;version:number;history:string[];paths?:string[];protected?:boolean;managed?:boolean;recordType?:'schedule'|'execution'|'notification';nextAt?:string|null;requiresReview?:boolean;readOnly?:boolean;kind?:'original'|'generated';sources?:SavedSourceRef[];dialogueCopy?:DialogueCopy;dialogueCopyCoverage?:'partial';importedFrom?:{name:string;bytes:number};originalAsset?:OriginalRef;mediaSource?:OriginalRef;vision?:{model:string;revision:string;prompt:string}};
