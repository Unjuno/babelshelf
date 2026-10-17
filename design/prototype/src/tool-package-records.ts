import searchSkill from './tools/memory.search/SKILL.md?raw';
import searchCode from './tools/memory.search/tool.ts?raw';
import readSkill from './tools/memory.read/SKILL.md?raw';
import readCode from './tools/memory.read/tool.ts?raw';
import hostCode from './tools/tool-host.ts?raw';
// Read-only canonical text projections of bundled sources. Never evaluated.
export const builtinPackageNotes = [
 ['memory.search/SKILL.md',searchSkill],['memory.search/tool.ts',searchCode],
 ['memory.read/SKILL.md',readSkill],['memory.read/tool.ts',readCode],
 ['tool-host.ts',hostCode],
].map(([relative,body])=>({id:'builtin-package-'+relative,path:'Tools/'+relative,body,version:1,history:[] as string[],protected:true}));
