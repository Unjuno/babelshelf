/** A guarded transaction made no write because its source is no longer current. */
export class GroundingConflictError extends Error {
 constructor(){super('Source changed · retry');this.name='GroundingConflictError';}
}
