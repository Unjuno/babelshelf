import test from 'node:test';import assert from 'node:assert/strict';
import {isSubmitKey} from '../dist/input-events.js';
test('IME composition and boundary Enter do not become submit requests',()=>{
 assert.equal(isSubmitKey({key:'Enter',shiftKey:false,isComposing:true,keyCode:13}),false);
 assert.equal(isSubmitKey({key:'Enter',shiftKey:false,isComposing:false,keyCode:229}),false);
 assert.equal(isSubmitKey({key:'Process',isComposing:false,keyCode:229}),false);
});
test('ordinary Enter still submits while Shift+Enter and other keys retain editing behavior',()=>{
 assert.equal(isSubmitKey({key:'Enter',shiftKey:false,isComposing:false,keyCode:13}),true);
 assert.equal(isSubmitKey({key:'Enter'}),true);
 assert.equal(isSubmitKey({key:'Enter',shiftKey:true,isComposing:false,keyCode:13}),false);
 for(const key of ['Tab','Escape','a','Unidentified'])assert.equal(isSubmitKey({key}),false);
});
