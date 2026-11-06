import test from 'node:test';
import assert from 'node:assert/strict';
import {requiresLargeContextLoadConfirmation} from '../src/large-context-load.ts';

test('large pinned LFM3 contexts ask before model load while normal and custom contexts remain direct',()=>{
 for(const context of [8192,16384,32768])assert.equal(requiresLargeContextLoadConfirmation('lfm3-1.7b-qad-q4-0',false,context),false);
 for(const context of [65536,131072,262144])assert.equal(requiresLargeContextLoadConfirmation('lfm3-1.7b-qad-q4-0',false,context),true);
 assert.equal(requiresLargeContextLoadConfirmation('local-lfm3-finetune',true,262144),false);
 assert.equal(requiresLargeContextLoadConfirmation('2B',false,262144),false);
 assert.equal(requiresLargeContextLoadConfirmation('lfm3-1.7b-qad-q4-0',false,Number.NaN),false);
});
