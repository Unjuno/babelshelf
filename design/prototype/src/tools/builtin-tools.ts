import * as search from './memory.search/tool.ts';
import * as list from './memory.list/tool.ts';
import * as read from './memory.read/tool.ts';
import * as calculate from './math.calculate/tool.ts';
import * as clock from './time.now/tool.ts';
import * as sources from './memory.sources/tool.ts';

// App-owned modules are the common source for registration, profile choices
// and activity presentation. Stored skill text cannot add an executable entry.
export const builtinTools = Object.freeze([
 Object.freeze({tool:search,settingsLabel:'Search files',activityLabel:'Search'}),
 Object.freeze({tool:list,settingsLabel:'List files',activityLabel:'List folder'}),
 Object.freeze({tool:read,settingsLabel:'Read files',activityLabel:'Read file'}),
 Object.freeze({tool:calculate,settingsLabel:'Calculator',activityLabel:'Calculate'}),
 Object.freeze({tool:clock,settingsLabel:'Clock',activityLabel:'Read time'}),
 Object.freeze({tool:sources,settingsLabel:'Source details',activityLabel:'Inspect sources'}),
] as const);

export const builtinToolIds = Object.freeze(builtinTools.map(({tool})=>tool.definition.id));
