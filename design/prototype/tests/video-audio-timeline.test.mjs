import test from 'node:test';
import assert from 'node:assert/strict';
import {createAudioTimeline} from '../src/video-audio-timeline.ts';

test('container placement preserves delay, silence and trims decoder padding',()=>{
 const t=createAudioTimeline(5,5.01,1000);
 t.add(5,[Float32Array.from([1,1,1,1]),Float32Array.from([3,3,3,3])]);
 t.add(5.006,[Float32Array.from([4,4,4,4,9,9])]);
 assert.deepEqual([...t.finish()],[2,2,2,2,0,0,4,4,4,4]);
});
test('invalid or contradictory timing fails without silently compressing samples',()=>{
 for(const args of [[-1,2,48000],[0,121,48000],[0,0,48000],[0,1,Infinity]])assert.throws(()=>createAudioTimeline(...args));
 const t=createAudioTimeline(0,1,1000);t.add(0,[new Float32Array(500)]);
 assert.throws(()=>t.add(.2,[new Float32Array(10)]),/overlap/i);
 assert.throws(()=>t.add(.5,[Float32Array.from([NaN])]),/sample/i);
 assert.throws(()=>createAudioTimeline(0,1,1000).finish(),/empty/i);
});
