import test from 'node:test';
import assert from 'node:assert/strict';
import {onnxTextModels,getOnnxTextManifest,isOnnxText,combinedTextManifest,validateOnnxTextBudget} from '../src/text-model-manifest.ts';
import {textExecutionRoute} from '../src/text-execution-route.ts';
import {transformerLoadOptions} from '../src/onnx-execution-options.ts';
import transformersPackage from '../node_modules/@huggingface/transformers/package.json' with {type:'json'};
import onnxPackage from '../node_modules/onnxruntime-web/package.json' with {type:'json'};
test('fixed ONNX model registry keeps independent model identities and aggregate asset budgets',()=>{
 const qwen=getOnnxTextManifest('qwen25-05b-instruct');assert.equal(qwen.architecture,'qwen2');assert.equal(qwen.files.reduce((n,f)=>n+f.bytes,0),519137612);assert.ok(isOnnxText(qwen.id));assert.equal(getOnnxTextManifest('user-supplied-runtime'),undefined);
 const base={contextTokens:2048,runtime:{revision:'webml'},models:[{id:'4B',revision:'bonsai'}]},merged=combinedTextManifest(base,qwen.id);assert.equal(merged.models.length,1+onnxTextModels.length);assert.equal(merged.models.find(m=>m.id===qwen.id).revision,qwen.revision);assert.equal(merged.runtime.revision,qwen.runtime.revision);assert.equal(combinedTextManifest(base,'4B').runtime.revision,'webml');
 assert.throws(()=>validateOnnxTextBudget(0,16,'unknown'),/Unknown/);
});

test('WebGPU ONNX alternative is an explicit pinned model variant with an exact GPU dtype',()=>{
 const cpu=getOnnxTextManifest('smollm2-360m-instruct'),gpu=getOnnxTextManifest('smollm2-360m-instruct-webgpu-q4f16');
 assert.equal(cpu.device,'wasm');assert.equal(cpu.dtype,'q8');
 assert.deepEqual(textExecutionRoute(cpu.id),{engine:'transformers-causal-wasm',backend:'cpu-wasm'});
 assert.equal(gpu.revision,cpu.revision);assert.equal(gpu.repository,cpu.repository);
 assert.equal(gpu.device,'webgpu');assert.equal(gpu.dtype,'q4f16');
 const weight=gpu.files.find(file=>file.path==='onnx/model_q4f16.onnx');
 assert.deepEqual({bytes:weight.bytes,sha256:weight.sha256},{bytes:272737275,sha256:'cc63370efc2aca6d5307518b85162777132cc5b8d68eeb8154ea9b5fce09ad46'});
 assert.equal(textExecutionRoute(gpu.id).backend,'webgpu');
 assert.deepEqual(transformerLoadOptions(gpu),{device:'webgpu',dtype:'q4f16'});
 assert.deepEqual(transformerLoadOptions(cpu),{device:'wasm',dtype:'q8'});
 assert.throws(()=>transformerLoadOptions({...gpu,device:'auto'}),/Unsupported ONNX execution profile/);
});

test('ONNX model provenance matches the exact locked Transformers.js and ONNX Runtime versions',()=>{
 const expected=`@huggingface/transformers@${transformersPackage.version} + onnxruntime-web@${onnxPackage.version}`;
 for(const model of onnxTextModels){assert.equal(model.runtime.revision,expected);assert.equal(model.runtime.onnxRevision,`onnxruntime-web@${onnxPackage.version}`);}
});
