export type Entry={key:string;value:any};
export type StateSnapshot={notes:any[];settings:Entry[];runs:Entry[]};
export type StatePayload={schema:1|2;createdAt:string;notes:any[];settings?:Entry[];runs?:Entry[];excluded?:string[]};
export type RestoreConflict={store:'notes'|'settings'|'runs';key:string;label:string};
export type StateRestorePlan={conflicts:RestoreConflict[];added:{notes:number;settings:number;runs:number};writes:StateSnapshot|null};
export type RestoreMode='strict'|'new-only';
