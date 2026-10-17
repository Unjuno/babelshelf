import test from 'node:test';
import assert from 'node:assert/strict';
import {onnxTextModels,getOnnxTextManifest,isOnnxText,combinedTextManifest,validateOnnxTextBudget} from '../src/text-model-manifest.ts';
test('fixed ONNX model registry keeps independent model identities and aggregate asset budgets',()=>{
 const qwen=getOnnxTextManifest('qwen25-05b-instruct');assert.equal(qwen.architecture,'qwen2');assert.equal(qwen.files.reduce((n,f)=>n+f.bytes,0),519137612);assert.ok(isOnnxText(qwen.id));assert.equal(getOnnxTextManifest('user-supplied-runtime'),undefined);
 const base={contextTokens:2048,runtime:{revision:'webml'},models:[{id:'4B',revision:'bonsai'}]},merged=combinedTextManifest(base,qwen.id);assert.equal(merged.models.length,1+onnxTextModels.length);assert.equal(merged.models.find(m=>m.id===qwen.id).revision,qwen.revision);assert.equal(merged.runtime.revision,qwen.runtime.revision);assert.equal(combinedTextManifest(base,'4B').runtime.revision,'webml');
 assert.throws(()=>validateOnnxTextBudget(0,16,'unknown'),/Unknown/);
});
