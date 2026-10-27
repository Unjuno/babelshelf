import test from 'node:test';
import assert from 'node:assert/strict';
import {textModelControls} from '../src/text-model-controls.ts';
test('custom records without assets offer local import and never network Prepare',()=>{
 for(const downloads of [false,true])assert.deepEqual(textModelControls({selected:true,custom:true,present:false,loaded:false,busy:false,downloads}),{status:'Local files required',verify:false,prepare:false,setup:false,load:false,unload:false,importFiles:true,retry:false});
});
test('verification and load are separate and preparation respects explicit network setting',()=>{
 const state={selected:true,custom:false,present:false,loaded:false,busy:false,downloads:false};assert.equal(textModelControls(state).prepare,false);assert.equal(textModelControls(state).setup,true);assert.equal(textModelControls({...state,downloads:true}).prepare,true);assert.equal(textModelControls({...state,downloads:true}).setup,false);assert.equal(textModelControls({...state,present:true}).load,true);assert.equal(textModelControls({...state,present:true}).setup,false);assert.equal(textModelControls({...state,present:true,loaded:true}).status,'Loaded');assert.equal(textModelControls({...state,selected:false}).importFiles,false);assert.equal(textModelControls({...state,present:true,busy:true}).load,false);
});

test('ONNX asset presence is not labelled fresh verification or loaded inference',()=>{
 assert.equal(textModelControls({selected:true,custom:false,present:true,presenceOnly:true,loaded:false,busy:false,downloads:false}).status,'Files present');
});

test("present text supports local verification independently of network and loaded state",()=>{for(const custom of [false,true])for(const downloads of [false,true]){const state={selected:true,custom,downloads,present:true,loaded:false,busy:false};assert.equal(textModelControls(state).verify,true);assert.equal(textModelControls(state).status,"Files present");assert.equal(textModelControls({...state,busy:true}).verify,false);assert.equal(textModelControls({...state,present:false}).verify,false);}});
test('unavailable status never claims a missing model or offers load and can be retried',()=>{
 const controls=textModelControls({selected:true,custom:false,present:false,statusError:true,loaded:false,busy:false,downloads:true});
 assert.equal(controls.status,'Files unavailable');assert.equal(controls.load,false);assert.equal(controls.prepare,false);assert.equal(controls.retry,true);
 assert.equal(textModelControls({selected:true,custom:false,present:false,statusError:true,loaded:false,busy:true,downloads:true}).retry,false);
});


test('present model files do not imply that the required local runtime is ready',()=>{
 const base={selected:true,custom:true,present:true,loaded:false,busy:false,downloads:false};
 const missing=textModelControls({...base,runtime:'missing'});
 assert.equal(missing.status,'Files present · Runtime not prepared');assert.equal(missing.load,false);assert.equal(missing.setup,true);
 const checking=textModelControls({...base,runtime:'checking'});assert.equal(checking.status,'Files present · Checking runtime');assert.equal(checking.load,false);
 const unavailable=textModelControls({...base,runtime:'unavailable'});assert.equal(unavailable.status,'Files present · Runtime check unavailable');assert.equal(unavailable.load,false);
 const ready=textModelControls({...base,runtime:'ready'});assert.equal(ready.status,'Files present');assert.equal(ready.load,true);
 assert.equal(textModelControls({...base,runtime:'missing',busy:true}).setup,false);
});
