import { validateQuery, type ToolHost } from '../tool-host.ts';
export const definition = Object.freeze({id: 'memory.search', version: 1, readOnly: true, network: 'none', inputSchema: {type: 'object', required: ['query'], additionalProperties: false, properties: {query: {type: 'string', minLength: 1, maxLength: 2000}}}});
export async function run(args: unknown, host: ToolHost) {
 const query = validateQuery(args);
 host.check();
 const result = await host.search(query);
 host.check();
 return result;
}
