// Stream a pinned model without saving the weights. This verifies the exact
// upstream file identity, not browser preparation or inference.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const id=process.argv[2];
if(!id)throw Error('Usage: node scripts/check-pinned-model-full.mjs <model-id>');
const manifest=JSON.parse(await readFile(new URL('../dist/model-manifest.json',import.meta.url),'utf8'));
const model=manifest.models.find(item=>item.id===id);
if(!model?.file?.url||!Number.isSafeInteger(model.file.bytes)||!model.file.sha256)throw Error('Unknown pinned model');

const response=await fetch(model.file.url,{headers:{Origin:'https://babelshelf.com'},signal:AbortSignal.timeout(15*60*1000)});
if(response.status!==200||!response.body)throw Error(`Full model response unavailable: ${response.status}`);
const declared=Number(response.headers.get('content-length'));
if(Number.isFinite(declared)&&declared!==model.file.bytes)throw Error('Declared model length mismatch');
const origin=response.headers.get('access-control-allow-origin');
if(origin!=='*'&&origin!=='https://babelshelf.com')throw Error('Model response does not permit the public origin');

const hash=createHash('sha256');
let bytes=0;
for await(const chunk of response.body){
 bytes+=chunk.byteLength;
 if(bytes>model.file.bytes)throw Error('Model exceeds pinned size');
 hash.update(chunk);
}
const sha256=hash.digest('hex');
if(bytes!==model.file.bytes||sha256!==model.file.sha256)throw Error('Pinned model content mismatch');
console.log(JSON.stringify({id,revision:model.revision,bytes,sha256,origin,fullFileVerified:true,inferenceVerified:false},null,2));
