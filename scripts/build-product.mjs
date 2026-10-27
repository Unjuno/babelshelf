import {productWorker} from './product-worker.mjs';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,readdir,mkdir,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {assertPinnedRuntimeExcluded} from './runtime-redistribution-policy.mjs';
const prototype=path.resolve('design/prototype');
execFileSync(process.execPath,[path.join(prototype,'scripts/prepare-license-notices.mjs')],{stdio:'inherit'});
execFileSync(process.execPath,['scripts/check-lfm.mjs'],{stdio:'inherit'});
execFileSync(process.execPath,[path.join(prototype,'scripts/prepare-ocr-runtime.mjs')],{stdio:'inherit'});
execFileSync(process.execPath,[path.join(prototype,'node_modules/typescript/bin/tsc'),'--project',path.join(prototype,'product/tsconfig.json')],{stdio:'inherit'});
execFileSync(process.execPath,[path.join(prototype,'node_modules/vite/bin/vite.js'),'build','--config',path.join(prototype,'product.vite.config.ts')],{cwd:prototype,stdio:'inherit'});
const root=path.join(prototype,'dist/app'),files=[];
function optionalRoles(file){
 const name=path.basename(file);
 if(name.startsWith('custom-tool-worker-')||name.startsWith('emscripten-module-'))return ['custom-tools'];
 if(name.startsWith('decision-worker-'))return ['decision'];
 if(name.startsWith('speech-worker-'))return ['speech'];
 if(name.startsWith('vision-worker-'))return ['vision'];
 if(name.startsWith('onnx-text-worker-'))return ['text-onnx'];
 if(name.startsWith('lfm-text-worker-')||name.startsWith('qwen3-text-worker-'))return ['text-wllama'];
 // The application imports this lightweight text helper during startup; it is
 // part of the offline shell, unlike the optional PDF.js processing engine.
 if(name.startsWith('pdf-text-'))return [];
 // The PDF JS chunks can change when the app's shared chunks change, even
 // without a PDF dependency update. Cache them with every verified shell so
 // an ordinary app update does not strand a previously prepared PDF reader.
 // PDF worker, fonts and cmaps remain explicitly prepared optional assets.
 if(name.startsWith('pdf-engine-')||name.startsWith('pdf-')&&name.endsWith('.js'))return [];
 if(name.startsWith('ort-wasm-simd-threaded.asyncify-'))return ['text-onnx','decision','speech','vision'];
 if(/^(default|compat)-.*\.wasm$/.test(name))return ['text-wllama'];
 if(/^wllama-.*\.wasm$/.test(name))return ['text-lfm-check'];
 if(/^(bridge|worker|lstm|simd-lstm|relaxedsimd-lstm)-.*\.bin$/.test(name))return ['ocr'];
 if(name.startsWith('pdf.worker.min-')||/\.(bcmap|pfb|ttf)$/.test(name))return ['pdf'];
 return [];
}
async function walk(folder){for(const entry of await readdir(folder,{withFileTypes:true})){const full=path.join(folder,entry.name);if(entry.isDirectory())await walk(full);else{const bytes=await readFile(full),filePath='./'+path.relative(root,full).split(path.sep).join('/'),roles=optionalRoles(filePath);files.push({path:filePath,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,...(roles.length?{roles}:{})});}}}
await mkdir(path.join(root,'licenses'),{recursive:true});for(const name of await readdir('design/prototype/licenses'))await copyFile(path.join('design/prototype/licenses',name),path.join(root,'licenses',name));
await walk(root);files.sort((a,b)=>a.path.localeCompare(b.path));
const upstreamManifest=JSON.parse(await readFile('dist/model-manifest.json','utf8'));
assertPinnedRuntimeExcluded(upstreamManifest,files);
// A binary transport keeps hosting-side HTML injection out of the offline shell.
// It carries the exact index bytes, verified against the same manifest entry.
const shell=files.find(file=>file.path==='./index.html');
if(!shell)throw Error('Missing app shell');
shell.downloadPath='./offline-shell-'+shell.sha256+'.bin';
await copyFile(path.join(root,'index.html'),path.join(root,shell.downloadPath));
const workerSource=await readFile(new URL('./product-worker.mjs',import.meta.url),'utf8');
const connectionPolicy=await readFile('dist/connection-policy.js','utf8');
const models=JSON.parse(await readFile('dist/model-manifest.json','utf8'));
const speech=JSON.parse(await readFile('design/prototype/src/speech-manifest.json','utf8'));
const speechBase=JSON.parse(await readFile('design/prototype/src/speech-base-manifest.json','utf8'));
const vision=JSON.parse(await readFile('design/prototype/src/vision-manifest.json','utf8'));
const decision=JSON.parse(await readFile('design/prototype/src/decision-manifest.json','utf8'));
const ocr=JSON.parse(await readFile('design/prototype/src/ocr-manifest.json','utf8'));
const onnxText=JSON.parse(await readFile('design/prototype/src/onnx-text-manifest.json','utf8'));
const qwenText=JSON.parse(await readFile('design/prototype/src/qwen-text-manifest.json','utf8'));
const lfm=JSON.parse(await readFile('dist/lfm-model-manifest.json','utf8'));
const remote=[...lfm.models.filter(m=>['lfm25-350m-qad-q4-0','lfm25-230m-qad-q4-0'].includes(m.id)).map(m=>m.file.url),...qwenText.files.map(f=>f.url),...onnxText.files.map(f=>f.url),...(onnxText.variants??[]).map(variant=>variant.weight.url),...decision.files.map(f=>f.url),...ocr.data.map(f=>f.url),models.runtime.file.url,...models.models.map(m=>m.file.url),...speech.files.map(f=>f.url),...speechBase.files.map(f=>f.url),...vision.files.map(f=>`https://huggingface.co/${vision.repository}/resolve/${vision.revision}/${f.path}`)];
// The remote allowlist is part of the worker's behavior even when emitted app
// assets and the worker template source are unchanged. Give that change a new
// build ID so existing PWA registrations can receive the reviewed update.
const build=createHash('sha256').update(JSON.stringify(files)).update(workerSource).update(connectionPolicy).update(JSON.stringify(remote)).digest('hex').slice(0,16);
const worker=productWorker({build,files,remote});
await writeFile(path.join(root,'sw.js'),worker);await writeFile(path.join(root,'build.json'),JSON.stringify({build,files},null,2));
console.log('Product shell '+build+' · '+files.length+' verified assets');
