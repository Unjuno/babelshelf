import {build} from '../../design/prototype/node_modules/vite/dist/node/index.js';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const [sourceArg,outArg]=process.argv.slice(2),source=resolve(sourceArg),out=resolve(outArg),hash=b=>createHash('sha256').update(b).digest('hex');
execFileSync(process.execPath,['scripts/check-wllama-count-source.mjs',source],{stdio:'inherit'});
const receipt=JSON.parse(await readFile('research/runtime/wllama-count/native-build.json','utf8'));
for(const pin of receipt.assets){const raw=await readFile(join(source,'build-count-cpu',pin.name));assert.equal(raw.length,pin.bytes);assert.equal(hash(raw),pin.sha256);}
let generated="// Generated from the pinned local CPU/count build.\nexport const LIBLLAMA_VERSION = 'b11364-46ca246+babelshelf-count1-cpu';\n";
for(const [file,name]of [['src/workers-code/llama-cpp.js','LLAMA_CPP_WORKER_CODE'],['src/workers-code/opfs-utils.js','OPFS_UTILS_WORKER_CODE'],['build-count-cpu/wllama.js','WLLAMA_EMSCRIPTEN_CODE']])generated+='export const '+name+' = '+JSON.stringify(await readFile(join(source,file),'utf8'))+';\n';
await writeFile(join(source,'src/workers-code/generated.ts'),generated);
await mkdir(out,{recursive:false});
await build({configFile:false,root:source,logLevel:'warn',build:{outDir:out,emptyOutDir:false,lib:{entry:join(source,'index.ts'),formats:['es'],fileName:()=> 'wllama-count.js'},minify:false}});
const js=await readFile(join(out,'wllama-count.js'));await writeFile(join(out,'bundle.json'),JSON.stringify({scope:'Isolated CPU default JSPI count extension; not product/runtime registration',native:receipt,generatedWorkerSha256:hash(generated),bundle:{bytes:js.length,sha256:hash(js)}},null,2));
console.log({bundleBytes:js.length,bundleSha256:hash(js)});
