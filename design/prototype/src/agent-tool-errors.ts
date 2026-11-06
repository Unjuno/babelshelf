/** Shared runtime/loop error for a tool result excluded by the active context budget. */
export class AgentToolResultTooLargeError extends Error {
 readonly code='result_too_large';
 constructor(message='Tool result exceeds the active context limit.'){super(message);this.name='AgentToolResultTooLargeError';}
}
