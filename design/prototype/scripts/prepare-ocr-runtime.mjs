import {readFile,writeFile,mkdir} from 'node:fs/promises';import {createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url)),manifest=JSON.parse(await readFile(path.join(root,'src/ocr-manifest.json'),'utf8')),out=path.join(root,'.ocr-runtime');await mkdir(out,{recursive:true});
for(const file of manifest.runtime.files){const source=path.join(root,'node_modules',file.id==='worker'?'tesseract.js/dist':'tesseract.js-core',file.name),bytes=await readFile(source);if(bytes.length!==file.bytes||createHash('sha256').update(bytes).digest('hex')!==file.sha256)throw Error('OCR runtime package differs from pinned manifest');await writeFile(path.join(out,file.id+'.bin'),bytes);}
await writeFile(path.join(out,'bridge.bin'),await readFile(path.join(root,'src/ocr-worker-bridge.js')));
console.log('OCR runtime · 4 package assets verified; classic-worker bytes preserved');
