/** Shared tool-catalog bound used by profile validation and planner schemas. */
export const MAX_CONFIGURED_AGENT_TOOLS=64;
/** Two application-owned discovery tools do not consume user catalog slots. */
export const AGENT_DISCOVERY_TOOL_IDS=['tools.search','tools.read-skill'] as const;
export const MAX_PLANNER_AGENT_TOOLS=MAX_CONFIGURED_AGENT_TOOLS+AGENT_DISCOVERY_TOOL_IDS.length;
/** Bound source references retained in transient agent and dialogue context. */
export const MAX_CONTEXT_SOURCE_REFS=64;
