// Model-independent action IDs and scopes. Descriptions never grant execution permission.
export const HARNESS_ACTIONS=[
 {id:'chat',purpose:'Conversation or semantic rewriting of dialogue',targets:[]},
 {id:'recall',purpose:'Read an exact dialogue original',targets:['current','history']},
 {id:'transform',purpose:'Literal split or replacement of dialogue text',targets:['current','history']},
 {id:'capture',purpose:'Propose a NEW note for review',targets:['current','history']},
 {id:'search',purpose:'Find saved notes',targets:['knowledge']},
 {id:'read',purpose:'Open a saved file',targets:['file','path']},
 {id:'answer',purpose:'Answer a question from saved knowledge',targets:['file','knowledge']},
 {id:'summary',purpose:'Summarize saved knowledge',targets:['file','knowledge']},
 {id:'edit',purpose:'Propose a correction of an existing saved file for review',targets:['file','path']},
 {id:'schedule',purpose:'Propose a NEW paused scheduled prompt for review',targets:[]}
] as const;
export function validHarnessAction(value:unknown){return HARNESS_ACTIONS.some(a=>a.id===value);}
export function validHarnessTarget(action:unknown,target:unknown){return HARNESS_ACTIONS.some(a=>a.id===action&&(a.targets as readonly unknown[]).includes(target));}
export const harnessActionCatalog=()=>JSON.stringify(HARNESS_ACTIONS);
