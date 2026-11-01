import test from 'node:test';
import assert from 'node:assert/strict';
import {withTensorResources} from '../src/tensor-resources.ts';

test('request tensors are released once before returning decoded output',async()=>{
 const events=[],input={dispose(){events.push('input');}},output={async dispose(){await Promise.resolve();events.push('output');}};
 const result=await withTensorResources(async own=>{assert.equal(own(input),input);own(input);own(output);own(7);return {text:'decoded',tokens:1};});
 assert.deepEqual(result,{text:'decoded',tokens:1});assert.deepEqual(events,['input','output']);
});
test('Stop or inference failure releases every tensor without replacing the original error',async()=>{
 for(const error of [Error('Stopped'),Error('Inference failed')]){
  const released=[];
  await assert.rejects(withTensorResources(async own=>{own({dispose(){released.push(1);throw Error('Cleanup failed');}});own({dispose(){released.push(2);}});throw error;}),actual=>actual===error);
  assert.deepEqual(released,[1,2]);
 }
});
test('cleanup failure after successful inference refuses success but still releases remaining tensors',async()=>{
 const failure=Error('Cleanup failed'),released=[];
 await assert.rejects(withTensorResources(async own=>{own({dispose(){released.push(1);throw failure;}});own({dispose(){released.push(2);}});return 'answer';}),error=>error===failure);
 assert.deepEqual(released,[1,2]);
});
