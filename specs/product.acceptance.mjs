import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {createHash} from 'node:crypto';
const root='design/prototype/dist/app/';
test('production shell contains every asset with exact size/hash and install metadata',async()=>{
 const manifest=JSON.parse(await fs.readFile(root+'build.json','utf8'));
 const workerSource=await fs.readFile('scripts/product-worker.mjs','utf8'),sw=await fs.readFile(root+'sw.js','utf8'),declaration=sw.match(/\bREMOTE=(\[[^;]*\]);/);
 assert.ok(declaration,'Worker remote allowlist missing');const remote=JSON.parse(declaration[1]);
 assert.equal(manifest.build,createHash('sha256').update(JSON.stringify(manifest.files)).update(workerSource).update(JSON.stringify(remote)).digest('hex').slice(0,16));
 assert.ok(manifest.files.length>=5);for(const entry of manifest.files){const bytes=await fs.readFile(root+entry.path.slice(2));assert.equal(bytes.length,entry.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256);}
 const shell=manifest.files.find(file=>file.path==='./index.html');assert.equal(shell.downloadPath,'./offline-shell-'+shell.sha256+'.bin');assert.deepEqual(await fs.readFile(root+shell.downloadPath.slice(2)),await fs.readFile(root+'index.html'));
 const html=await fs.readFile(root+'index.html','utf8');assert.match(html,/viewport-fit=cover/);assert.match(html,/manifest.webmanifest/);
 const install=JSON.parse(await fs.readFile(root+'manifest.webmanifest','utf8'));assert.equal(install.display,'standalone');
 assert.match(sw,/App asset verification failed/);assert.match(sw,/status:503/);assert.match(sw,/REMOTE.includes/);
});
test('production entry excludes simulated device and keyboard runtime',async()=>{
 const entries=await fs.readdir(root+'assets');const app=await fs.readFile(root+'assets/'+entries.find(n=>/^index.*\.js$/.test(n)),'utf8');
 assert.ok(!app.includes('keyboard-asset'));assert.ok(!app.includes('Preview device:'));assert.ok(!app.includes('@vite/client'));
});
test('published worker permits every pinned Vision preparation URL and no neighboring revision',async()=>{
 const vision=JSON.parse(await fs.readFile('design/prototype/src/vision-manifest.json','utf8'));
 const sw=await fs.readFile(root+'sw.js','utf8'),declaration=sw.match(/\bREMOTE=(\[[^;]*\]);/);
 assert.ok(declaration,'Worker remote allowlist missing');
 const allowed=new Set(JSON.parse(declaration[1]));
 for(const file of vision.files){
  const url=`https://huggingface.co/${vision.repository}/resolve/${vision.revision}/${file.path}`;
  assert.ok(allowed.has(url),`Vision preparation blocked: ${file.path}`);
 }
 assert.equal(allowed.has(`https://huggingface.co/${vision.repository}/resolve/main/${vision.files[0].path}`),false);
});
test('published worker permits every pinned built-in model asset',async()=>{
 const read=async file=>JSON.parse(await fs.readFile(file,'utf8'));
 const [bonsai,lfm,smol,qwen,decision,ocr,speech,vision]=await Promise.all([
  read('dist/model-manifest.json'),read('dist/lfm-model-manifest.json'),
  read('design/prototype/src/onnx-text-manifest.json'),read('design/prototype/src/qwen-text-manifest.json'),
  read('design/prototype/src/decision-manifest.json'),read('design/prototype/src/ocr-manifest.json'),
  read('design/prototype/src/speech-manifest.json'),read('design/prototype/src/vision-manifest.json')
 ]);
 const sw=await fs.readFile(root+'sw.js','utf8');
 const declaration=sw.match(/\bREMOTE=(\[[^;]*\]);/);
 assert.ok(declaration,'Worker remote allowlist missing');
 const actual=JSON.parse(declaration[1]);
 const required=[
  ...lfm.models.map(model=>model.file.url),...smol.files.map(file=>file.url),
  ...qwen.files.map(file=>file.url),...decision.files.map(file=>file.url),
  ...ocr.data.map(file=>file.url),bonsai.runtime.file.url,
  ...bonsai.models.map(model=>model.file.url),...speech.files.map(file=>file.url),
  ...vision.files.map(file=>`https://huggingface.co/${vision.repository}/resolve/${vision.revision}/${file.path}`)
 ];
 assert.deepEqual([...actual].sort(),[...required].sort(),'Service Worker remote asset list differs from pinned model manifests');
 assert.equal(new Set(actual).size,actual.length,'Duplicate model asset URL');
 for(const url of actual){
  assert.match(url,/^https:\/\/(?:huggingface\.co|cdn\.jsdelivr\.net)\//);
  assert.doesNotMatch(url,/\/resolve\/(?:main|master)\//);
  if(url.startsWith('https://huggingface.co/'))assert.match(url,/\/resolve\/[a-f0-9]{40}\//,'Hugging Face assets must use an immutable revision');
 }
});
