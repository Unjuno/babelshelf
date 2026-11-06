import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {isAbsolute} from 'node:path';
import {rolldown} from 'rolldown';
import {withTensorResources} from '../src/tensor-resources.ts';

const bundle=await rolldown({input:fileURLToPath(new URL('../src/vision-worker.ts',import.meta.url)),external:id=>id==='./tensor-resources'||!isAbsolute(id)});
const source=(await bundle.generate({format:'cjs'})).output[0].code;await bundle.close();
function fixture(mode='success'){
 const events=[],messages=[],manifest={id:'lfm25-vl-450m-q4f16',revision:'fixture',runtime:'fixture-runtime'};
 const tensor=name=>({dims:[1,2],dispose(){events.push('dispose:'+name);if(mode==='cleanup-error'&&name==='pixel-values'||mode==='decode-cleanup-error'&&name==='input-ids')throw Error('Cleanup failed');},slice(){return tensor('sliced');}});
 const processor=async()=>({input_ids:tensor('input-ids'),pixel_values:tensor('pixel-values')});
 processor.apply_chat_template=()=> 'fixture prompt';
 processor.batch_decode=()=>{if(mode==='decode-error'||mode==='decode-cleanup-error')throw Error('Decode failed');return ['A cat'];};
 const model={async generate(){events.push('generate');if(mode==='generate-error')throw Error('Generate failed');return tensor('outputs');}};
 const self={navigator:{gpu:{}},postMessage(message){messages.push(message);events.push(message.error?'error':message.progress?'progress':'done');}};
 const require=id=>{
  if(id==='@huggingface/transformers')return {env:{},AutoProcessor:{from_pretrained:async()=>processor},AutoModelForImageTextToText:{from_pretrained:async()=>model},RawImage:{read:async()=>({width:640,height:480})}};
  if(id.endsWith('?url'))return {default:'https://local.invalid/runtime/'+(id.includes('.wasm')?'runtime.wasm':'runtime.mjs')};
  if(id==='./transformers-runtime')return {configureLocalTransformerRuntime(){}};
  if(id==='./vision-assets')return {visionManifest:manifest,visionReady:async()=>true,visionRuntimeResponse:async()=>new Response('')};
  if(id==='./custom-vision-assets.ts')return {customVisionModelDescriptor(){},customVisionReady:async()=>false,customVisionRuntimeResponse:async()=>new Response(''),readCustomVisionFile:async()=>new Uint8Array(),validateCustomVisionModel(){throw Error('unexpected custom model')}};
  if(id==='./vision-webgpu.ts')return {requireVisionWebGPU:async()=>{}};
  if(id==='./vision-output.ts')return {validateVisionOutput:value=>value};
  if(id==='./tensor-resources')return {withTensorResources};
  throw Error('Unexpected import '+id);
 };
 vm.runInNewContext(source,{require,exports:{},self,Blob,URL,Response,AbortController,location:{href:'https://local.invalid/'}});
 return {events,messages,async run(){await self.onmessage({data:{id:1,type:'describe',model:manifest.id,image:new Blob(['image'],{type:'image/png'}),prompt:'Describe the image'}});return messages.at(-1);}};
}

test('Vision worker releases each acquired image tensor after a successful response',async()=>{
 const f=fixture();const result=await f.run();assert.equal(result.value.text,'A cat');
 assert.deepEqual(f.events.filter(value=>value.startsWith('dispose:')),['dispose:input-ids','dispose:pixel-values','dispose:outputs','dispose:sliced']);
 assert.equal(f.events.at(-1),'done');
});

test('Vision worker releases every acquired tensor when generation or decode fails and preserves the original error',async()=>{
 for(const [mode,error,hasOutputs] of [['generate-error','Generate failed',false],['decode-error','Decode failed',true],['decode-cleanup-error','Decode failed',true]]){
  const f=fixture(mode),result=await f.run();assert.equal(result.error,error);
  assert.deepEqual(f.events.filter(value=>value.startsWith('dispose:')),['dispose:input-ids','dispose:pixel-values',...(hasOutputs?['dispose:outputs','dispose:sliced']:[])]);
  assert.equal(f.events.at(-1),'error');
 }
});

test('Vision worker attempts remaining tensor disposal and reports cleanup failure after a successful decode',async()=>{
 const f=fixture('cleanup-error'),result=await f.run();assert.equal(result.error,'Cleanup failed');
 assert.deepEqual(f.events.filter(value=>value.startsWith('dispose:')),['dispose:input-ids','dispose:pixel-values','dispose:outputs','dispose:sliced']);
 assert.equal(f.events.at(-1),'error');
});
