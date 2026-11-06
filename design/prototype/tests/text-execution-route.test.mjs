import test from 'node:test';
import assert from 'node:assert/strict';
import {textExecutionIdentity,textExecutionQuantization} from '../src/text-execution-route.ts';
import baseManifest from '../../../dist/model-manifest.json' with {type:'json'};
import {getOnnxTextManifest} from '../src/text-model-manifest.ts';

test('diagnostic identity follows the selected model route, revision and runtime',()=>{
 const bonsai=textExecutionIdentity('4B');
 assert.deepEqual(bonsai,{engine:'webml-qwen35',backend:'webgpu',revision:baseManifest.models.find(model=>model.id==='4B').revision,runtimeRevision:baseManifest.runtime.revision});

 const cpu=textExecutionIdentity('smollm2-360m-instruct');
 const cpuManifest=getOnnxTextManifest('smollm2-360m-instruct');
 assert.deepEqual(cpu,{engine:'transformers-causal-wasm',backend:'cpu-wasm',revision:cpuManifest.revision,runtimeRevision:cpuManifest.runtime.revision});

 const gpu=textExecutionIdentity('smollm2-360m-instruct-webgpu-q4f16');
 const gpuManifest=getOnnxTextManifest('smollm2-360m-instruct-webgpu-q4f16');
 assert.deepEqual(gpu,{engine:'transformers-causal-webgpu',backend:'webgpu',revision:gpuManifest.revision,runtimeRevision:gpuManifest.runtime.revision});
 assert.equal(textExecutionIdentity('unregistered-model'),null);
});

test('diagnostic quantization covers pinned GGUF and ONNX registrations',()=>{
 assert.equal(textExecutionQuantization('lfm3-1.7b-qad-q4-0'),'Q4_0');
 assert.equal(textExecutionQuantization('lfm3-1.7b-q8-0'),'Q8_0');
 assert.equal(textExecutionQuantization('lfm3-1.7b-iq3m'),'IQ3_M');
 assert.equal(textExecutionQuantization('lfm25-350m-qad-q4-0'),'Q4_0');
 assert.equal(textExecutionQuantization('4B'),'PTQ1_0');
 assert.equal(textExecutionQuantization('smollm2-360m-instruct-webgpu-q4f16'),'q4f16');
 assert.equal(textExecutionQuantization('unregistered-model'),undefined);
});
