import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve('.');
const manifestPath=path.join(root,'design/prototype/runtime/wllama-lfm3/manifest.json');
const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
if(manifest.schema!==1||manifest.status!=='product-connected-candidate; redistribution-review-partial'||manifest.model!=='LFM3-1.7B-QAD-Q4_0')throw Error('Unexpected LFM3 runtime contract');
const sourcePins=JSON.parse(await readFile(path.join(root,'research/runtime/wllama-lfm3/source-pins.json'),'utf8'));
const sourcePatch=await readFile(path.join(root,'research/runtime/wllama-lfm3/wllama-count.patch'));
const sourcePatchHash=createHash('sha256').update(sourcePatch).digest('hex');
if(sourcePatchHash!==manifest.wllama.patchSha256||sourcePatchHash!==sourcePins.wllama.patchSha256)throw Error('LFM3 source patch pin mismatch');
const nativePatch=await readFile(path.join(root,'research/runtime/wllama-lfm3/llama-emcc-fix.patch'));
const nativePatchHash=createHash('sha256').update(nativePatch).digest('hex');
if(nativePatchHash!==manifest.llamaCpp.patchSha256||nativePatchHash!==sourcePins.llamaCpp.compilePatchSha256)throw Error('LFM3 llama.cpp source patch pin mismatch');
for(const asset of manifest.assets){
 if(!/^[a-z0-9.-]+$/.test(asset.path)||!Number.isSafeInteger(asset.bytes)||asset.bytes<1||!/^[a-f0-9]{64}$/.test(asset.sha256))throw Error('Invalid LFM3 runtime asset pin');
 const bytes=await readFile(path.join(path.dirname(manifestPath),asset.path));
 if(bytes.length!==asset.bytes||createHash('sha256').update(bytes).digest('hex')!==asset.sha256)throw Error('LFM3 runtime asset pin mismatch: '+asset.path);
}
for(const [section,key] of [['wllama','licenseFile'],['llamaCpp','licenseFile']]){
 const sectionInfo=manifest[section],file=path.resolve(path.dirname(manifestPath),sectionInfo[key]);
 if(!file.startsWith(root+path.sep))throw Error('LFM3 license path escaped repository');
 const bytes=await readFile(file);
 if(createHash('sha256').update(bytes).digest('hex')!==sectionInfo.licenseSha256)throw Error('LFM3 runtime license pin mismatch: '+section);
 const bundled=await readFile(path.join(root,'design/prototype/licenses',path.basename(file)),'utf8');
 if(bundled.replace(/\r\n/g,'\n')!==bytes.toString('utf8').replace(/\r\n/g,'\n'))throw Error('Bundled LFM3 runtime notice mismatch: '+section);
}
const notices=manifest.webgpuPort?.licenseNotices;
if(!Array.isArray(notices)||notices.length!==2||manifest.webgpuPort?.sourceArchiveReviewed!==true||!String(manifest.webgpuPort?.overallRuntimeRedistributionReview??'').startsWith('partial;'))throw Error('LFM3 Emdawn notice review contract missing');
for(const notice of notices){if(typeof notice.component!=='string'||typeof notice.license!=='string'||typeof notice.licenseFile!=='string'||!/^[a-f0-9]{64}$/.test(notice.licenseSha256))throw Error('Invalid LFM3 Emdawn notice pin');const file=path.resolve(path.dirname(manifestPath),notice.licenseFile);if(!file.startsWith(root+path.sep))throw Error('LFM3 Emdawn notice path escaped repository');const bytes=await readFile(file);if(createHash('sha256').update(bytes).digest('hex')!==notice.licenseSha256)throw Error('LFM3 Emdawn notice pin mismatch: '+notice.component);const bundled=await readFile(path.join(root,'design/prototype/licenses',path.basename(file)),'utf8');if(bundled.replace(/\r\n/g,'\n')!==bytes.toString('utf8').replace(/\r\n/g,'\n'))throw Error('Bundled LFM3 Emdawn notice mismatch: '+notice.component);}
const expectedCompiledNotices=['llamafile-sgemm-MIT.txt','llamacpp-rotate-bits-MIT.txt','llamacpp-sha256-public-domain.txt','emscripten-musl-COPYRIGHT.txt','emscripten-libcxx-LICENSE.txt','emscripten-libcxxabi-LICENSE.txt','emscripten-libunwind-LICENSE.txt','emscripten-compiler-rt-LICENSE.txt','emscripten-LICENSE.txt','emscripten-dlmalloc-notice.txt','nlohmann-json-3.12.0-MIT.txt','stb-image-notice.txt','miniaudio-notice.txt'];
const compiled=manifest.compiledNotices;
if(!Array.isArray(compiled)||compiled.length!==expectedCompiledNotices.length||new Set(compiled.map(item=>item?.file)).size!==expectedCompiledNotices.length||expectedCompiledNotices.some(name=>!compiled.some(item=>item?.file===name)))throw Error('LFM3 compiled notice inventory incomplete');
for(const notice of compiled){if(!expectedCompiledNotices.includes(notice.file)||!/^[a-f0-9]{64}$/.test(notice.sha256))throw Error('Invalid LFM3 compiled notice pin');const file=path.join(root,'design/prototype/licenses',notice.file);if(createHash('sha256').update(await readFile(file)).digest('hex')!==notice.sha256)throw Error('LFM3 compiled notice pin mismatch: '+notice.file);}
console.log('LFM3 product-candidate runtime bytes and Wllama / llama.cpp / Emdawn notice pins: PASS · transitive redistribution review remains partial');
