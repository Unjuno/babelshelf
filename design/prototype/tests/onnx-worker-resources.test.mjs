import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {isAbsolute} from 'node:path';
import {rolldown} from 'rolldown';

const bundle=await rolldown({input:fileURLToPath(new URL('../src/onnx-text-worker.ts',import.meta.url)),external:id=>!isAbsolute(id)&&id!=='./tensor-resources'});
const source=(await bundle.generate({format:'cjs'})).output[0].code;await bundle.close();
function fixture(mode='success'){
 const events=[],messages=[],manifest={id:'fixture',architecture:'qwen2',revision:'fixture'};
 const tensor=(name,dims)=>({dims,dispose(){events.push('dispose:'+name);},tolist(){return [[1,2,3]];}});
 const self={postMessage(message){events.push(message.type);messages.push(message);}};
 const tokenizer={apply_chat_template(){return {input_ids:tensor('input',[1,2]),attention_mask:tensor('mask',[1,2])};},decode(){if(mode==='decode-error')throw Error('Decode failed');return 'answer';}};
 const model={async generate(){if(mode==='generate-error')throw Error('Generate failed');if(mode==='stop')await self.onmessage({data:{cmd:'abort'}});return tensor('output',[1,3]);},async dispose(){events.push('model-dispose');}};
 const require=id=>{
  if(id==='@huggingface/transformers')return {env:{},AutoTokenizer:{from_pretrained:async()=>tokenizer},AutoModelForCausalLM:{from_pretrained:async()=>model},LogitsProcessor:class{},LogitsProcessorList:class extends Array{}};
  if(id.endsWith('?url'))return {default:'https://local.invalid/runtime/'+(id.includes('.wasm')?'runtime.wasm':'runtime.mjs')};
  if(id==='./structured-decoding')return {createStructuredTokenFilter(){throw Error('Unexpected structured request');}};
  if(id==='./text-model-manifest')return {onnxTextModels:[manifest],getOnnxTextManifest:()=>manifest,validateOnnxTextBudget(){if(mode==='budget-error')throw Error('Budget exceeded');}};
  if(id==='./pinned-text-assets')return {createPinnedAssetStore:()=>({read:async()=>({text:async()=>JSON.stringify({model_type:'qwen2',architectures:['Qwen2ForCausalLM']})})})};
  if(id==='./prepared-text-backend')return {};
  if(id==='./transformers-runtime')return {configureLocalTransformerRuntime(){}};
  if(id==='./onnx-execution-options')return {transformerLoadOptions:()=>({device:'wasm',dtype:'q8'})};
  throw Error('Unexpected import '+id);
 };
 vm.runInNewContext(source,{require,exports:{},self,URL,AbortController,Response,location:{href:'https://local.invalid/'},fetch:async()=>{throw Error('Unexpected network');}});
 return {events,messages,async call(cmd){await self.onmessage({data:{id:1,cmd,args:{model:'fixture',messages:[{role:'user',content:'hello'}],maxTokens:4}}});return messages.at(-1);}};
}

test('actual ONNX Worker releases count tensors and generation tensors before done without unloading the model',async()=>{
 const f=fixture();await f.call('load');f.events.length=0;
 assert.equal((await f.call('count')).value.prompt_tokens,2);assert.deepEqual(f.events,['dispose:input','dispose:mask','done']);
 f.events.length=0;const answer=await f.call('generate');assert.equal(answer.value.text,'answer');assert.equal(answer.value.outputTokens,1);
 assert.deepEqual(f.events,['progress','dispose:input','dispose:mask','dispose:output','done']);
});
test('actual ONNX Worker releases allocated tensors on budget, inference, decode and Stop failures',async()=>{
 for(const [mode,error,output] of [['budget-error','Budget exceeded',false],['generate-error','Generate failed',false],['decode-error','Decode failed',true],['stop','Stopped',true]]){
  const f=fixture(mode);await f.call('load');f.events.length=0;const result=await f.call('generate');
  assert.equal(result.type,'error');assert.equal(result.value,error);
  assert.deepEqual(f.events.filter(value=>value.startsWith('dispose:')),['dispose:input','dispose:mask',...(output?['dispose:output']:[])]);
  assert.equal(f.events.at(-1),'error');assert.equal(f.events.includes('model-dispose'),false);
 }
});
