import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareTextRuntime } from '../design/prototype/src/text-runtime-preparation.ts';

function setup(overrides = {}) {
  const events = [];
  const input = {
    model: 'text-model',
    loadedModel: false,
    check() { events.push('check'); },
    releaseCompeting() { events.push('release'); },
    prepareSelected() { events.push('prepare'); },
    pin() { events.push('pin'); return 'pinned-runtime'; },
    ...overrides,
  };
  return { events, input };
}

test('prepares a selected model after releasing competing inference, then pins it', async () => {
  const { events, input } = setup();

  const runtime = await prepareTextRuntime(input);

  assert.equal(runtime, 'pinned-runtime');
  assert.deepEqual(events, ['check', 'release', 'check', 'prepare', 'check', 'pin']);
});

test('releases competing inference but does not reload an already loaded selected model', async () => {
  const { events, input } = setup({ loadedModel: 'text-model' });

  const runtime = await prepareTextRuntime(input);

  assert.equal(runtime, 'pinned-runtime');
  assert.deepEqual(events, ['check', 'release', 'check', 'pin']);
});

test('does not load or pin when releasing a competing model fails', async () => {
  const { events, input } = setup({
    releaseCompeting() { events.push('release'); throw Error('Model busy'); },
  });

  await assert.rejects(prepareTextRuntime(input), /Model busy/);
  assert.deepEqual(events, ['check', 'release']);
});

test('does not load or pin when preparation is cancelled', async () => {
  const { events, input } = setup({
    prepareSelected() { events.push('prepare'); },
    check() {
      events.push('check');
      if (events.filter(event => event === 'check').length === 3) throw Error('Stopped');
    },
  });

  await assert.rejects(prepareTextRuntime(input), /Stopped/);
  assert.deepEqual(events, ['check', 'release', 'check', 'prepare', 'check']);
});
