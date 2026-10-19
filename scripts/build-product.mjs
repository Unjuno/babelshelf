import {productWorker} from './product-worker.mjs';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,readdir,mkdir,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const prototype=path.resolve('design/prototype');
execFileSync(process.execPath,['scripts/check-lfm.mjs'],{stdio:'inherit'});
execFileSync(process.execPath,[path.join(prototype,'scripts/prepare-ocr-runtime.mjs')],{stdio:'inherit'});
execFileSync(process.execPath,[path.join(prototype,'node_modules/typescript/bin/tsc'),'--project',path.join(prototype,'product/tsconfig.json')],{stdio:'inherit'});
execFileSync(process.execPath,[path.join(prototype,'node_modules/vite/bin/vite.js'),'build','--config',path.join(prototype,'product.vite.config.ts')],{cwd:prototype,stdio:'inherit'});
const root=path.join(prototype,'dist/app'),files=[];
async function walk(folder){for(const entry of await readdir(folder,{withFileTypes:true})){const full=path.join(folder,entry.name);if(entry.isDirectory())await walk(full);else{const bytes=await readFile(full);files.push({path:'./'+path.relative(root,full).split(path.sep).join('/'),sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length});}}}
await mkdir(path.join(root,'licenses'),{recursive:true});for(const name of await readdir('design/prototype/licenses'))await copyFile(path.join('design/prototype/licenses',name),path.join(root,'licenses',name));
await walk(root);files.sort((a,b)=>a.path.localeCompare(b.path));
// A binary transport keeps hosting-side HTML injection out of the offline shell.
// It carries the exact index bytes, verified against the same manifest entry.
const shell=files.find(file=>file.path==='./index.html');
if(!shell)throw Error('Missing app shell');
shell.downloadPath='./offline-shell-'+shell.sha256+'.bin';
await copyFile(path.join(root,'index.html'),path.join(root,shell.downloadPath));
const workerSource=await readFile(new URL('./product-worker.mjs',import.meta.url),'utf8');
const build=createHash('sha256').update(JSON.stringify(files)).update(workerSource).digest('hex').slice(0,16),models=JSON.parse(await readFile('dist/model-manifest.json','utf8'));
const speech=JSON.parse(await readFile('design/prototype/src/speech-manifest.json','utf8'));
const decision=JSON.parse(await readFile('design/prototype/src/decision-manifest.json','utf8'));
const ocr=JSON.parse(await readFile('design/prototype/src/ocr-manifest.json','utf8'));
const onnxText=JSON.parse(await readFile('design/prototype/src/onnx-text-manifest.json','utf8'));
const qwenText=JSON.parse(await readFile('design/prototype/src/qwen-text-manifest.json','utf8'));
const lfm=JSON.parse(await readFile('dist/lfm-model-manifest.json','utf8'));
const remote=[...lfm.models.filter(m=>['lfm25-350m-qad-q4-0','lfm25-230m-qad-q4-0'].includes(m.id)).map(m=>m.file.url),...qwenText.files.map(f=>f.url),...onnxText.files.map(f=>f.url),...decision.files.map(f=>f.url),...ocr.data.map(f=>f.url),models.runtime.file.url,...models.models.map(m=>m.file.url),...speech.files.map(f=>f.url)];
const worker=productWorker({build,files,remote});
await writeFile(path.join(root,'sw.js'),worker);await writeFile(path.join(root,'build.json'),JSON.stringify({build,files},null,2));
console.log('Product shell '+build+' · '+files.length+' verified assets');
