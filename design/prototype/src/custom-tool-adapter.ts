import type {CustomToolPackage} from './custom-tool-types.ts';
import type {ToolPackage} from './tools/tool-registry.ts';
import type {ToolHost} from './tools/tool-host.ts';
import {validateToolArguments} from './tools/tool-input.ts';
import {calculate as evaluateExpression} from './tools/math.calculate/tool.ts';
type CustomToolRunner=typeof import('./custom-tool-runtime.ts')['runCustomToolSource'];

const utf8=new TextEncoder();

/** Validate JSON arguments against the intentionally small, closed input schema. */
export function validateCustomToolArguments(pkg:Pick<CustomToolPackage,'inputSchema'>,value:unknown):Record<string,unknown>{
 return validateToolArguments(pkg.inputSchema,value);
}

/** Adapt an inspected user package to the same registry used by built-ins.
 * The source stays data; it is executed only by runCustomToolSource's disposable QuickJS Worker.
 */
export async function customToolRegistration(pkg:CustomToolPackage,run?:CustomToolRunner):Promise<ToolPackage>{
 if(!pkg||!/^user\.[a-z][a-z0-9-]{0,47}$/.test(pkg.id)||!Number.isSafeInteger(pkg.version)||pkg.version<1||!Array.isArray(pkg.capabilities)||pkg.capabilities.some(cap=>cap!=='memory.search'&&cap!=='memory.read'&&cap!=='math.calculate')||new Set(pkg.capabilities).size!==pkg.capabilities.length||typeof pkg.code!=='string'||utf8.encode(pkg.code).byteLength>32_000||typeof pkg.sha256!=='string'||!/^([a-f0-9]{64})$/.test(pkg.sha256))throw Error('Invalid custom tool package');
 const entry=`Tools/${pkg.id}/tool.js`,skillPath=`Tools/${pkg.id}/SKILL.md`;
 if(pkg.entry!==entry||typeof pkg.skillSource!=='string'||pkg.skillSource.length>12_000||typeof pkg.title!=='string'||!pkg.title.trim()||utf8.encode(pkg.title).byteLength>120||typeof pkg.skill!=='string'||!pkg.skill.trim()||utf8.encode(pkg.skill).byteLength>8_000)throw Error('Invalid custom tool package');
 const envelope=JSON.stringify({schema:1,id:pkg.id,version:pkg.version,title:pkg.title,entry,capabilities:[...pkg.capabilities].sort(),inputSchema:pkg.inputSchema,skill:pkg.skillSource,code:pkg.code});
 const digest=await crypto.subtle.digest('SHA-256',utf8.encode(envelope)),verified=[...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('');
 if(verified!==pkg.sha256)throw Error('Custom tool package identity changed after inspection');
 // Validate the exact persisted source again so callers cannot substitute a permissive schema.
 const entrySource=`Tools/${pkg.id}/tool.js`,skillSource=`Tools/${pkg.id}/SKILL.md`;
 const {inspectCustomToolPackage}=await import('./custom-tool-package.ts');
 const checked=await inspectCustomToolPackage([{path:skillSource,body:pkg.skillSource},{path:entrySource,body:pkg.code}]);
 if(checked.sha256!==pkg.sha256)throw Error('Custom tool package identity changed after inspection');
 const trusted=checked;
 const execute:CustomToolRunner=run??(options=>import('./custom-tool-runtime.ts').then(({runCustomToolSource})=>runCustomToolSource(options)));
 return {
  definition:{id:trusted.id,version:trusted.version,readOnly:true,network:'none',inputSchema:trusted.inputSchema},entry,
  sources:[{path:skillSource,body:trusted.skillSource},{path:entrySource,body:trusted.code}],
  async run(value,host:ToolHost){
   const input=validateCustomToolArguments(trusted,value);
   const capabilities=[...trusted.capabilities];
   return execute({code:trusted.code,input,capabilities,signal:host.signal,host:{
    search:capabilities.includes('memory.search')?(query,signal)=>host.search(query,signal):undefined,
    read:capabilities.includes('memory.read')?(query,signal)=>host.resolve(query,signal):undefined,
    calculate:capabilities.includes('math.calculate')?expression=>evaluateExpression(expression):undefined,
   }});
  },
 };
}
