import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=resolve(process.argv[2]),pins=JSON.parse(await readFile('research/runtime/wllama-count/source-pins.json','utf8'));
const hash=value=>createHash('sha256').update(value).digest('hex');
assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),pins.wllamaRevision);
assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:join(root,'llama.cpp'),encoding:'utf8'}).trim(),pins.llamaCppRevision);
assert.equal(hash(await readFile('research/runtime/wllama-count/UPSTREAM-LICENCE')),pins.license.sha256);
const patch=await readFile('research/runtime/wllama-count/count.patch');assert.equal(hash(patch),pins.patchSha256);
for(const file of pins.files){assert.equal(hash(execFileSync('git',['show','HEAD:'+file.path],{cwd:root})),file.baseSha256);assert.equal(hash((await readFile(join(root,file.path),'utf8')).replace(/\r\n/g,'\n')),file.patchedLfSha256);}
for(const path of ['dist/lfm-model-manifest.json','design/prototype/src/lfm-manifest.json'])assert.equal(JSON.parse(await readFile(path,'utf8')).normalHarness.supported,false);
console.log('Pinned count extension sources match; normal LFM registration remains disabled. This does not verify compiled runtime behavior.');
