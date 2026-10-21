// Queue/lifecycle unit check against the actual compiled JS wrapper.
// The producer below is a controlled callback source, NOT model inference.
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const [bundle] = process.argv.slice(2);
assert.ok(bundle, 'Usage: check-wllama-stream-abort PRIVATE_COMPILED_BUNDLE');
const {Wllama, WllamaAbortError} = await import(pathToFileURL(resolve(bundle)));
const unhandled = [];
process.on('unhandledRejection', error => unhandled.push(String(error)));
const outcomes = [];
for (const mode of ['normal', 'queued-abort', 'unrelated-error', 'ignored-abort', 'last-chunk-abort']) {
  const control = new AbortController(), instance = Object.create(Wllama.prototype);
  let producerReleased = false;
  instance.createCompletionImpl = async options => {
    try {
      options.onData({unit: 'first'});
      if (mode !== 'last-chunk-abort') options.onData({unit: 'queued'});
      await new Promise(resolve => setTimeout(resolve, 10));
      if (mode === 'unrelated-error') throw Error('unit unrelated producer failure');
      if (mode === 'queued-abort' && options.abortSignal.aborted) throw new WllamaAbortError();
    } finally {producerReleased = true;}
  };
  const seen = []; let failure;
  try {
    for await (const chunk of await instance.createCompletionGenerator({stream: true, abortSignal: control.signal})) {
      seen.push(chunk.unit);
      if (mode !== 'normal') control.abort();
    }
  } catch (error) {failure = {name: error.name, message: error.message};}
  assert.equal(producerReleased, true, mode + ': producer must release before return');
  if (mode === 'normal') {assert.deepEqual(seen, ['first', 'queued']); assert.equal(failure, undefined);}
  else {
    assert.deepEqual(seen, ['first'], mode + ': queued content leaked after abort');
    if (mode === 'queued-abort') assert.equal(failure?.name, 'AbortError');
    else if (mode === 'unrelated-error') assert.equal(failure?.message, 'unit unrelated producer failure');
    else assert.equal(failure?.message, 'Inference completed without cancellation');
  }
  outcomes.push({mode, seen, failure: failure ?? null, producerReleased, passed: true});
}
await new Promise(resolve => setTimeout(resolve, 20));
assert.deepEqual(unhandled, [], 'Unobserved producer rejection');
console.log(JSON.stringify({scope: 'Actual compiled wrapper queue unit tests; controlled producer, no model inference', version: Wllama.getLibllamaVersion(), outcomes, passed: true}, null, 2));
