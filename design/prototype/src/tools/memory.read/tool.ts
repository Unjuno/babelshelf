import { validateQuery, type ToolHost } from '../tool-host.ts';
export const definition = Object.freeze({id: 'memory.read', version: 2, readOnly: true, network: 'none', inputSchema: {type: 'object', required: ['query'], additionalProperties: false, properties: {query: {type: 'string', minLength: 1, maxLength: 2000}}}});
export async function run(args: unknown, host: ToolHost) {
 const query = validateQuery(args);
 host.check();
 const notes = await host.views();
 const byId = notes.filter(n => n.id === query);
 const byPath = byId.length ? [] : notes.filter(n => n.path === query);
 const result = byId.length ? byId : byPath.length ? byPath : notes.filter(n => n.path.split('/').at(-1) === query);
 host.check();
 return result;
}
