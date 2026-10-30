import {builtinTools} from './tools/builtin-tools.ts';
import calculateSkill from './tools/math.calculate/SKILL.md?raw';
import calculateCode from './tools/math.calculate/tool.ts?raw';
import decimalCode from './tools/math.calculate/decimal-calculation.ts?raw';
import receiptCode from './tools/math.calculate/decimal-receipt.ts?raw';
import clockSkill from './tools/time.now/SKILL.md?raw';
import clockCode from './tools/time.now/tool.ts?raw';
import sourcesSkill from './tools/memory.sources/SKILL.md?raw';
import sourcesCode from './tools/memory.sources/tool.ts?raw';
import {createToolRegistry} from './tools/tool-registry.ts';
import searchSkill from './tools/memory.search/SKILL.md?raw';
import searchCode from './tools/memory.search/tool.ts?raw';
import readSkill from './tools/memory.read/SKILL.md?raw';
import readCode from './tools/memory.read/tool.ts?raw';
import listSkill from './tools/memory.list/SKILL.md?raw';
import listCode from './tools/memory.list/tool.ts?raw';
import hostCode from './tools/tool-host.ts?raw';
// Read-only canonical text projections of bundled sources. Never evaluated.
export const builtinPackageNotes = [
 ['memory.search/SKILL.md',searchSkill],['memory.search/tool.ts',searchCode],
 ['memory.read/SKILL.md',readSkill],['memory.read/tool.ts',readCode],
 ['memory.list/SKILL.md',listSkill],['memory.list/tool.ts',listCode],
 ['time.now/SKILL.md',clockSkill],['time.now/tool.ts',clockCode],
 ['memory.sources/SKILL.md',sourcesSkill],['memory.sources/tool.ts',sourcesCode],
 ['math.calculate/SKILL.md',calculateSkill],['math.calculate/tool.ts',calculateCode],
 ['math.calculate/decimal-calculation.ts',decimalCode],['math.calculate/decimal-receipt.ts',receiptCode],
 ['tool-host.ts',hostCode],
].map(([relative,body])=>({id:'builtin-package-'+relative,path:'Tools/'+relative,body,version:1,history:[] as string[],protected:true}));

// Trusted module references are app-owned; stored text cannot add an entry.
export const builtinToolPackages=builtinTools.map(({tool})=>({
 definition:tool.definition,entry:'Tools/'+tool.definition.id+'/tool.ts',run:tool.run,
 sources:builtinPackageNotes.filter(n=>n.path.startsWith('Tools/'+tool.definition.id+'/')||n.path==='Tools/tool-host.ts').map(n=>({path:n.path,body:n.body})),
}));
export const builtinToolRegistry=createToolRegistry(builtinToolPackages);
