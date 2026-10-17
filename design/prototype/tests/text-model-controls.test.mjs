import test from 'node:test';
import assert from 'node:assert/strict';
import {textModelControls} from '../src/text-model-controls.ts';
test('custom records without assets offer local import and never network Prepare',()=>{
 for(const downloads of [false,true])assert.deepEqual(textModelControls({selected:true,custom:true,present:false,loaded:false,busy:false,downloads}),{status:'Local files required',verify:false,prepare:false,load:false,unload:false,importFiles:true});
});
test('verification and load are separate and preparation respects explicit network setting',()=>{
 const state={selected:true,custom:false,present:false,loaded:false,busy:false,downloads:false};assert.equal(textModelControls(state).prepare,false);assert.equal(textModelControls({...state,downloads:true}).prepare,true);assert.equal(textModelControls({...state,present:true}).load,true);assert.equal(textModelControls({...state,present:true,loaded:true}).status,'Loaded');assert.equal(textModelControls({...state,selected:false}).importFiles,false);assert.equal(textModelControls({...state,present:true,busy:true}).load,false);
});

test('ONNX asset presence is not labelled fresh verification or loaded inference',()=>{
 assert.equal(textModelControls({selected:true,custom:false,present:true,presenceOnly:true,loaded:false,busy:false,downloads:false}).status,'Files present');
});

test("present text supports local verification independently of network and loaded state",()=>{for(const custom of [false,true])for(const downloads of [false,true]){const state={selected:true,custom,downloads,present:true,loaded:false,busy:false};assert.equal(textModelControls(state).verify,true);assert.equal(textModelControls(state).status,"Files present");assert.equal(textModelControls({...state,busy:true}).verify,false);assert.equal(textModelControls({...state,present:false}).verify,false);}});
