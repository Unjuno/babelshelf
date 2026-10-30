import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeFinalPlanTools} from '../src/native-output-format.ts';

test('native final answer explains that source identifiers belong in metadata',()=>{
 const scope={inputs:false,file:false,current:false,historyCount:0,assistantIndices:[],toolIds:[]};
 const tools=nativeFinalPlanTools(scope,['S1'],true),answer=tools.find(item=>item.function.name.endsWith('answer'));
 assert.ok(answer);assert.match(answer.function.description,/source labels belong only in sources/i);
});
