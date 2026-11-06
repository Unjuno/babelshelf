import test from 'node:test';
import assert from 'node:assert/strict';

const policy=await import('../scripts/runtime-redistribution-policy.mjs').catch(()=>({}));
const assertPinnedRuntimeExcluded=policy.assertPinnedRuntimeExcluded;
const revision='1'.repeat(40),runtime={runtime:{revision,file:{url:`https://huggingface.co/spaces/example/resolve/${revision}/assets/runtime-abcd.js`,sha256:'a'.repeat(64)}}};

test('product asset lists may omit the pinned upstream runtime',()=>{
 assert.equal(typeof assertPinnedRuntimeExcluded,'function');
 assert.doesNotThrow(()=>assertPinnedRuntimeExcluded(runtime,[{path:'./assets/app.js',sha256:'b'.repeat(64)}]));
});

test('product build rejects the exact pinned runtime by hash or upstream asset name',()=>{
 assert.equal(typeof assertPinnedRuntimeExcluded,'function');
 assert.throws(()=>assertPinnedRuntimeExcluded(runtime,[{path:'./assets/renamed.js',sha256:'a'.repeat(64)}]),/runtime.*redistribut/i);
 assert.throws(()=>assertPinnedRuntimeExcluded(runtime,[{path:'./assets/runtime-abcd.js',sha256:'b'.repeat(64)}]),/runtime.*redistribut/i);
});

test('product build fails closed when runtime identity is not pinned',()=>{
 assert.equal(typeof assertPinnedRuntimeExcluded,'function');
 assert.throws(()=>assertPinnedRuntimeExcluded({runtime:{file:{url:'not a url',sha256:'bad'}}},[]),/runtime.*pin/i);
 assert.throws(()=>assertPinnedRuntimeExcluded({runtime:{...runtime.runtime,revision:'not-a-revision'}},[]),/runtime.*pin/i);
 assert.throws(()=>assertPinnedRuntimeExcluded({runtime:{...runtime.runtime,file:{...runtime.runtime.file,url:'https://huggingface.co/spaces/example/resolve/other/assets/runtime-abcd.js'}}},[]),/runtime.*pin/i);
});
