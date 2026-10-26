export type SubmissionOutcome=
 | {kind:'answered'|'imported'|'displayed'|'awaitingApproval'}
 | {kind:'needsPreparation'|'needsInput'|'partial';reason:string}
 | {kind:'cancelled'|'failed';reason?:string};

/** A host-owned requirement, never inferred by parsing a model's error text. */
export class ModelPreparationRequired extends Error {
 readonly code='not_prepared';
 readonly reason:'model-selection'|'model-files'|'decision-files';
 constructor(reason:ModelPreparationRequired['reason'],message:string){super(message);this.reason=reason;this.name='ModelPreparationRequired';}
}
