import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {createHash} from 'node:crypto';
const root='design/prototype/dist/app/';
test('production shell contains every asset with exact size/hash and install metadata',async()=>{
 const manifest=JSON.parse(await fs.readFile(root+'build.json','utf8'));
 const workerSource=await fs.readFile('scripts/product-worker.mjs','utf8');assert.equal(manifest.build,createHash('sha256').update(JSON.stringify(manifest.files)).update(workerSource).digest('hex').slice(0,16));
 assert.ok(manifest.files.length>=5);for(const entry of manifest.files){const bytes=await fs.readFile(root+entry.path.slice(2));assert.equal(bytes.length,entry.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256);}
 const html=await fs.readFile(root+'index.html','utf8');assert.match(html,/viewport-fit=cover/);assert.match(html,/manifest.webmanifest/);
 const install=JSON.parse(await fs.readFile(root+'manifest.webmanifest','utf8'));assert.equal(install.display,'standalone');
 const sw=await fs.readFile(root+'sw.js','utf8');assert.match(sw,/App asset verification failed/);assert.match(sw,/status:503/);assert.match(sw,/REMOTE.includes/);
});
test('production entry excludes simulated device and keyboard runtime',async()=>{
 const entries=await fs.readdir(root+'assets');const app=await fs.readFile(root+'assets/'+entries.find(n=>/^index.*\.js$/.test(n)),'utf8');
 assert.ok(!app.includes('keyboard-asset'));assert.ok(!app.includes('Preview device:'));assert.ok(!app.includes('@vite/client'));
});
