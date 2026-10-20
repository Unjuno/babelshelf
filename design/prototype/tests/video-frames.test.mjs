import test from 'node:test';
import assert from 'node:assert/strict';
import {videoFramePlan,validateSampledFrame} from '../src/video-frame-plan.ts';

test('sparse video plan uses bounded container timestamps and preserves display aspect ratio',()=>{
 const p=videoFramePlan({trackId:3,start:2,end:14,width:1920,height:1080});
 assert.deepEqual(p,{schema:1,processor:'mediabunny-1.61.6',timebase:'container-presentation',trackId:3,startUs:2000000,endUs:14000000,width:768,height:432,timestampsUs:[4000000,8000000,12000000],coverage:'sampled-frames-only'});
 assert.deepEqual(videoFramePlan({trackId:1,start:-1,end:2,width:100,height:200}).timestampsUs,[333333,1000000,1666667]);
 assert.deepEqual(videoFramePlan({trackId:1,start:0,end:.000001,width:1,height:1}).timestampsUs,[0]);
});

test('invalid or excessive video bounds refuse without selecting a different track or clipping silently',()=>{
 const valid={trackId:1,start:0,end:10,width:1920,height:1080};
 for(const patch of [{end:0},{end:601},{end:Infinity},{start:NaN},{start:11},{width:0},{height:1.5},{width:10000,height:10000},{trackId:-1},{trackId:0}])assert.throws(()=>videoFramePlan({...valid,...patch}),/unsupported/i);
 assert.equal(videoFramePlan({...valid,end:600}).endUs,600000000);
});

test('decoded sample owns its actual interval; requested timestamp cannot stand in for it',()=>{
 const p=videoFramePlan({trackId:1,start:0,end:12,width:640,height:360}),target=p.timestampsUs[0];
 assert.deepEqual(validateSampledFrame(p,target,{timestamp:1.9,duration:.2,width:640,height:360}),{requestedUs:2000000,timestampUs:1900000,durationUs:200000,width:640,height:360});
 for(const sample of [{timestamp:2.1,duration:.2,width:640,height:360},{timestamp:1,duration:.2,width:640,height:360},{timestamp:1.9,duration:0,width:640,height:360},{timestamp:1.9,duration:.2,width:320,height:180},{timestamp:NaN,duration:.2,width:640,height:360}])assert.throws(()=>validateSampledFrame(p,target,sample),/unavailable/i);
 assert.throws(()=>validateSampledFrame(p,123,{timestamp:0,duration:1,width:640,height:360}),/unavailable/i);
});
