import test from 'node:test';
import assert from 'node:assert/strict';
import {textExecutionIdentity} from '../src/text-execution-route.ts';
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
