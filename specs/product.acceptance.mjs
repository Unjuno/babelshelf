import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {createHash} from 'node:crypto';
const root='design/prototype/dist/app/';
test('the pinned LFM3 model license is included separately in the offline app',async()=>{
 const file='LFM3-1.7B-LICENSE.txt',expected='4d28ca14dedc0b3d0fcc2b3339f0e79931faa33874f3d24f522183a8fc70068c';
 const local=await fs.readFile('design/prototype/licenses/'+file),packaged=await fs.readFile(root+'licenses/'+file);
 assert.equal(createHash('sha256').update(local).digest('hex'),expected);assert.deepEqual(packaged,local);
 const inventory=JSON.parse(await fs.readFile('design/prototype/src/generated/package-notices.json','utf8'));
 assert.ok(inventory.bundledNotices.includes(file));
});
test('paged search worker is part of the verified offline shell',async()=>{
 const manifest=JSON.parse(await fs.readFile(root+'build.json','utf8'));
 const workers=manifest.files.filter(file=>/^\.\/assets\/search-worker-.*\.js$/.test(file.path));
 assert.equal(workers.length,1);assert.equal(workers[0].roles,undefined);
 const bytes=await fs.readFile(root+workers[0].path.slice(2));assert.equal(bytes.length,workers[0].bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),workers[0].sha256);
});
test('production shell contains every asset with exact size/hash and install metadata',async()=>{
 const manifest=JSON.parse(await fs.readFile(root+'build.json','utf8'));
 const workerSource=await fs.readFile('scripts/product-worker.mjs','utf8'),sw=await fs.readFile(root+'sw.js','utf8'),declaration=sw.match(/\bREMOTE=(\[[^;]*\]);/);
 assert.ok(declaration,'Worker remote allowlist missing');const remote=JSON.parse(declaration[1]);
 const connectionPolicy=await fs.readFile('dist/connection-policy.js','utf8');
 assert.equal(manifest.build,createHash('sha256').update(JSON.stringify(manifest.files)).update(workerSource).update(connectionPolicy).update(JSON.stringify(remote)).digest('hex').slice(0,16));
 assert.ok(manifest.files.length>=5);for(const entry of manifest.files){const bytes=await fs.readFile(root+entry.path.slice(2));assert.equal(bytes.length,entry.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256);}
 const shell=manifest.files.find(file=>file.path==='./index.html');assert.equal(shell.downloadPath,'./offline-shell-'+shell.sha256+'.bin');assert.deepEqual(await fs.readFile(root+shell.downloadPath.slice(2)),await fs.readFile(root+'index.html'));
 const html=await fs.readFile(root+'index.html','utf8');assert.match(html,/viewport-fit=cover/);assert.match(html,/manifest.webmanifest/);assert.match(html,/<title>BabelShelf<\/title>/);
 const install=JSON.parse(await fs.readFile(root+'manifest.webmanifest','utf8'));assert.equal(install.display,'standalone');assert.equal(install.name,'BabelShelf');assert.equal(install.short_name,'BabelShelf');
 assert.match(sw,/App asset verification failed/);assert.match(sw,/status:503/);assert.match(sw,/REMOTE.includes/);
});
test('production entry excludes simulated device and keyboard runtime',async()=>{
 const entries=await fs.readdir(root+'assets');const app=await fs.readFile(root+'assets/'+entries.find(n=>/^index.*\.js$/.test(n)),'utf8');
 assert.ok(!app.includes('keyboard-asset'));assert.ok(!app.includes('Preview device:'));assert.ok(!app.includes('@vite/client'));
});
test('production shell does not precache developer-only runtime QA pages',async()=>{
 const manifest=JSON.parse(await fs.readFile(root+'build.json','utf8'));
 const qaChunks=manifest.files.filter(file=>/\/assets\/(?:LfmCheck|HarnessCheck|SpeechCheck|DecisionCheck)-/.test(file.path));
 assert.deepEqual(qaChunks.map(file=>file.path),[],'QA pages belong to development builds, not the production offline shell');
});
test('production shell includes the LFM3 update worker but keeps optional runtimes on demand',async()=>{
 const manifest=JSON.parse(await fs.readFile(root+'build.json','utf8'));
 const roleFor=(prefix,role)=>{
  const matches=manifest.files.filter(file=>file.path.startsWith('./assets/'+prefix));
  assert.equal(matches.length,1,`Expected one built asset for ${prefix}`);
  assert.deepEqual(matches[0].roles,[role],`${prefix} must be acquired through its selected feature role`);
 };
 roleFor('decision-worker-','decision');roleFor('speech-worker-','speech');roleFor('vision-worker-','vision');
 const visionAssets=manifest.files.filter(file=>file.path.startsWith('./assets/vision-assets-worker-'));
 assert.equal(visionAssets.length,1,'Local Vision inspection needs its lightweight asset worker');
 assert.equal(visionAssets[0].roles,undefined,'Local Vision file import must work before inference runtime preparation');
 assert.ok(visionAssets[0].bytes<128*1024,'Asset inspection must not bundle the inference engine');
 roleFor('onnx-text-worker-','text-onnx');roleFor('lfm-text-worker-','text-wllama');roleFor('qwen3-text-worker-','text-wllama');
 roleFor('lfm3-text-worker-','text-lfm3');
 const shellRoleFiles=manifest.files.filter(file=>file.shell===true&&file.roles?.length);
 assert.equal(shellRoleFiles.length,1,'Only the LFM3 worker is a role asset needed for offline app updates');
 assert.match(shellRoleFiles[0].path,/^\.\/assets\/lfm3-text-worker-.*\.js$/);
 const lfm3Wasm=manifest.files.filter(file=>file.roles?.includes('text-lfm3')&&file.path.endsWith('.wasm'));
 assert.ok(lfm3Wasm.length>0);for(const file of lfm3Wasm)assert.notEqual(file.shell,true,`${file.path} remains an optional runtime asset`);
 const pdfEngine=manifest.files.filter(file=>file.path.startsWith('./assets/pdf-engine-')&&file.path.endsWith('.js'));
 assert.equal(pdfEngine.length,1,'Expected one PDF engine');
 assert.equal(pdfEngine[0].roles,undefined,'PDF engine is part of the verified core shell for offline updates');
 const pdfText=manifest.files.find(file=>file.path.startsWith('./assets/pdf-text-')&&file.path.endsWith('.js'));
 if(pdfText)assert.equal(pdfText.roles,undefined,'The startup text helper must be available offline');
 const pdfChunks=manifest.files.filter(file=>file.path.startsWith('./assets/pdf-')&&!file.path.startsWith('./assets/pdf-text-')&&file.path.endsWith('.js'));
 assert.ok(pdfChunks.length>=2,'The PDF engine and PDF.js chunks must be in the core shell');
 for(const file of pdfChunks)assert.equal(file.roles,undefined,file.path+' must be available in the core shell');
 roleFor('pdf.worker.min-','pdf');
 const sw=await fs.readFile(root+'sw.js','utf8');
 assert.match(sw,/INSTALL_FILES=FILES\.filter\(file=>file\.shell===true\|\|!Array\.isArray\(file\.roles\)\|\|file\.roles\.length===0\)/);
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
 const [bonsai,lfm,lfm3,lfm3Q8,smol,qwen,decision,ocr,speech,speechBase,vision]=await Promise.all([
  read('dist/model-manifest.json'),read('dist/lfm-model-manifest.json'),
  read('design/prototype/src/lfm3-manifest.json'),read('design/prototype/src/lfm3-q8-manifest.json'),
  read('design/prototype/src/onnx-text-manifest.json'),read('design/prototype/src/qwen-text-manifest.json'),
  read('design/prototype/src/decision-manifest.json'),read('design/prototype/src/ocr-manifest.json'),
  read('design/prototype/src/speech-manifest.json'),read('design/prototype/src/speech-base-manifest.json'),read('design/prototype/src/vision-manifest.json')
 ]);
 const sw=await fs.readFile(root+'sw.js','utf8');
 const declaration=sw.match(/\bREMOTE=(\[[^;]*\]);/);
 assert.ok(declaration,'Worker remote allowlist missing');
 const actual=JSON.parse(declaration[1]);
 const required=[
  ...lfm.models.map(model=>model.file.url),...smol.files.map(file=>file.url),...(smol.variants??[]).map(variant=>variant.weight.url),
  ...qwen.files.map(file=>file.url),...decision.files.map(file=>file.url),
  ...ocr.data.map(file=>file.url),bonsai.runtime.file.url,
  ...bonsai.models.map(model=>model.file.url),...speech.files.map(file=>file.url),...speechBase.files.map(file=>file.url),
  ...vision.files.map(file=>`https://huggingface.co/${vision.repository}/resolve/${vision.revision}/${file.path}`),
  lfm3.file.url,lfm3Q8.file.url
 ];
 assert.deepEqual([...actual].sort(),[...required].sort(),'Service Worker remote asset list differs from pinned model manifests');
 assert.equal(new Set(actual).size,actual.length,'Duplicate model asset URL');
 for(const url of actual){
  assert.match(url,/^https:\/\/(?:huggingface\.co|cdn\.jsdelivr\.net)\//);
  assert.doesNotMatch(url,/\/resolve\/(?:main|master)\//);
  if(url.startsWith('https://huggingface.co/'))assert.match(url,/\/resolve\/[a-f0-9]{40}\//,'Hugging Face assets must use an immutable revision');
 }
});
