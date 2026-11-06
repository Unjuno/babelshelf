import test from 'node:test';
import assert from 'node:assert/strict';
import { createTaskCancellation } from '../design/prototype/src/task-cancellation.ts';

test('stopping a task aborts its signal, stops local inference and trips the shared guard', () => {
  let inferenceStops = 0;
  const task = createTaskCancellation(() => { inferenceStops++; });

  task.check();
  assert.equal(task.signal.aborted, false);
  assert.equal(task.stop(), true);
  assert.equal(task.signal.aborted, true);
  assert.equal(inferenceStops, 1);
  assert.throws(() => task.check(), /Stopped/);
});

test('repeated Stop requests do not stop inference more than once', () => {
  let inferenceStops = 0;
  const task = createTaskCancellation(() => { inferenceStops++; });

  assert.equal(task.stop(), true);
  assert.equal(task.stop(), false);
  assert.equal(inferenceStops, 1);
});

test('a terminal result wins once saving starts and a late Stop cannot abort it', () => {
  let inferenceStops = 0;
  const task = createTaskCancellation(() => { inferenceStops++; });

  assert.equal(task.claimCompletion(), true);
  assert.equal(task.stop(), false);
  assert.equal(task.signal.aborted, false);
  assert.equal(inferenceStops, 0);
  assert.equal(task.claimCompletion(), false);
});

test('Stop wins before completion and prevents claiming a terminal result', () => {
  let inferenceStops = 0;
  const task = createTaskCancellation(() => { inferenceStops++; });

  assert.equal(task.stop(), true);
  assert.equal(task.claimCompletion(), false);
  assert.equal(task.signal.aborted, true);
  assert.equal(inferenceStops, 1);
});
