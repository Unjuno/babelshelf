// Model-independent action IDs and scopes. Descriptions never grant execution permission.
export const HARNESS_ACTIONS=[
 {id:'calculate',purpose:'Calculate an explicit arithmetic expression; query is the expression, no units or code',targets:[]},
 {id:'chat',purpose:'Conversation or semantic rewriting of dialogue',targets:[]},
 {id:'recall',purpose:'Read an exact dialogue original',targets:['current','history']},
 {id:'transform',purpose:'Literal split or replacement of dialogue text',targets:['current','history']},
 {id:'capture',purpose:'Propose a NEW note for review',targets:['current','history','inputs']},
 {id:'search',purpose:'Find saved notes',targets:['knowledge']},
 {id:'read',purpose:'Open a saved file',targets:['file','path']},
 {id:'answer',purpose:'Answer a question from saved knowledge',targets:['file','knowledge','inputs']},
 {id:'summary',purpose:'Summarize saved knowledge',targets:['file','knowledge','inputs']},
 {id:'edit',purpose:'Propose a correction of an existing saved file for review',targets:['file','path']},
 {id:'schedule',purpose:'Propose a NEW paused scheduled prompt for review',targets:[]}
] as const;
export function validHarnessAction(value:unknown){return HARNESS_ACTIONS.some(a=>a.id===value);}
export function validHarnessTarget(action:unknown,target:unknown){return HARNESS_ACTIONS.some(a=>a.id===action&&(a.targets as readonly unknown[]).includes(target));}
export type PlannerScope={inputs:boolean;file:boolean;current:boolean;historyCount:number;assistantIndices?:number[]};
export function validatePlannerScope(value:PlannerScope){
 if(!value||Object.keys(value).some(k=>!['inputs','file','current','historyCount','assistantIndices'].includes(k))||['inputs','file','current'].some(k=>typeof value[k as keyof PlannerScope]!=='boolean')||!Number.isSafeInteger(value.historyCount)||value.historyCount<0)throw Error('Invalid planner scope');
 if(value.assistantIndices!==undefined&&(!Array.isArray(value.assistantIndices)||value.assistantIndices.some((index,i,all)=>!Number.isSafeInteger(index)||index<0||index>=value.historyCount||i>0&&index<=all[i-1])))throw Error('Invalid planner assistant indices');
 return value;
}
export function scopedHarnessActions(scope:PlannerScope){
 validatePlannerScope(scope);
 return HARNESS_ACTIONS.map(action=>({...action,targets:(action.targets as readonly string[]).filter(target=>
  (!scope.inputs||!['answer','summary'].includes(action.id)||target==='inputs')&&
  (target!=='inputs'||scope.inputs)&&(target!=='file'||scope.file)&&(target!=='current'||scope.current)&&(target!=='history'||scope.historyCount>0)
 )})).filter(action=>(action.id!=='calculate'||!scope.inputs)&&(!['recall','transform'].includes(action.id)||action.targets.length>0));
}
export const harnessActionCatalog=(currentInputs=false,scope?:PlannerScope)=>JSON.stringify(scope?scopedHarnessActions(scope):HARNESS_ACTIONS.map(action=>currentInputs&&['answer','summary'].includes(action.id)?{...action,targets:['inputs']}:action));
