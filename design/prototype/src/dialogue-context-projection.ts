import type {DialogueContext} from './dialogue-contract.ts';

/** Current submitted inputs own the request scope, so omit an unrelated open-file hint. */
export function planningContextForInputs(context:DialogueContext,currentInputs:boolean):DialogueContext{
 if(!currentInputs)return context;
 const {currentFile,...rest}=context;
 return rest;
}
