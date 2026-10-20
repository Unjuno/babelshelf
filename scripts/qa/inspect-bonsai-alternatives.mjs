// Inspect retained exact-revision HTTP206 prefixes with the production intake
// validator. An extent check against declared size is not weight verification.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {inspectGGUF} from '../../dist/gguf-inspect.js';
import {eligibleTextEngine} from '../../dist/local-engines.js';
const [directory,output]=process.argv.slice(2);if(!directory||!output)throw Error('Use HEADER_DIRECTORY OUTPUT.json');
const results=[];
for(const quantization of ['PQ2_0','Q2_0']){
 const descriptor=JSON.parse(await readFile(path.join(directory,quantization+'.json'),'utf8')),prefix=await readFile(path.join(directory,quantization+'.header'));
 if(prefix.length!==descriptor.headerBytes||prefix.length>16*1024*1024||createHash('sha256').update(prefix).digest('hex')!==descriptor.headerSha256)throw Error('Prefix mismatch');
 const file={size:descriptor.bytes,slice(start,end){if(start!==0||end>prefix.length)throw Error('Unbounded header read');return new Blob([prefix.subarray(start,end)]);}};
 const inspection=await inspectGGUF(file),adapter=eligibleTextEngine(inspection)?.id??null;
 results.push({repository:descriptor.repository,revision:descriptor.revision,quantization,headerSha256:descriptor.headerSha256,inspection,adapter,weightsVerified:false,generationVerified:false});
}
await writeFile(output,JSON.stringify({scope:'Production intake on actual bounded remote prefixes; not full weights, loading or generation',results},null,2));console.log(JSON.stringify(results));
