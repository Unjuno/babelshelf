import * as calculateTool from './tools/math.calculate/tool.ts';
import calculateSkill from './tools/math.calculate/SKILL.md?raw';
import calculateCode from './tools/math.calculate/tool.ts?raw';
import * as searchTool from './tools/memory.search/tool.ts';
import * as readTool from './tools/memory.read/tool.ts';
import {createToolRegistry} from './tools/tool-registry.ts';
import searchSkill from './tools/memory.search/SKILL.md?raw';
import searchCode from './tools/memory.search/tool.ts?raw';
import readSkill from './tools/memory.read/SKILL.md?raw';
import readCode from './tools/memory.read/tool.ts?raw';
import hostCode from './tools/tool-host.ts?raw';
// Read-only canonical text projections of bundled sources. Never evaluated.
export const builtinPackageNotes = [
 ['memory.search/SKILL.md',searchSkill],['memory.search/tool.ts',searchCode],
 ['memory.read/SKILL.md',readSkill],['memory.read/tool.ts',readCode],
 ['math.calculate/SKILL.md',calculateSkill],['math.calculate/tool.ts',calculateCode],
 ['tool-host.ts',hostCode],
].map(([relative,body])=>({id:'builtin-package-'+relative,path:'Tools/'+relative,body,version:1,history:[] as string[],protected:true}));

// Trusted module references are app-owned; stored text cannot add an entry.
export const builtinToolPackages=[searchTool,readTool,calculateTool].map(tool=>({
 definition:tool.definition,entry:'Tools/'+tool.definition.id+'/tool.ts',run:tool.run,
 sources:builtinPackageNotes.filter(n=>n.path.startsWith('Tools/'+tool.definition.id+'/')||n.path==='Tools/tool-host.ts').map(n=>({path:n.path,body:n.body})),
}));
export const builtinToolRegistry=createToolRegistry(builtinToolPackages);
