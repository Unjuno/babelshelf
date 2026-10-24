import test from 'node:test';
import assert from 'node:assert/strict';
import {createToolRegistry} from '../src/tools/tool-registry.ts';
import {runCalculationAction} from '../src/calculation-action.ts';

const host={check(){},search:async()=>[],resolve:async()=>[]};

function registry(result){
 const entry='Tools/math.calculate/tool.ts';
 return createToolRegistry([{definition:{id:'math.calculate',version:2,readOnly:true,network:'none'},entry,sources:[{path:'Tools/math.calculate/SKILL.md',body:'Calculate locally.'},{path:entry,body:'Bundled calculator.'}],run:async()=>result}]);
}

test('local calculations share the registered tool identity, trace and typed result boundary',async()=>{
 const expected=[{expression:'(6 + 4) / 2',result:5,precision:'IEEE-754 binary64'}];
 let recorded;
 const result=await runCalculationAction('(6 + 4) / 2',registry(expected),host,async(tool,input,work)=>{
  recorded={tool,input};
  return work();
 });
 assert.deepEqual(result,expected);
 assert.equal(recorded.tool,'math.calculate');
 assert.equal(recorded.input.expression,'(6 + 4) / 2');
 assert.equal(recorded.input.package,'math.calculate');
 assert.equal(recorded.input.packageVersion,2);
 assert.match(recorded.input.packageSha256,/^[0-9a-f]{64}$/);
});

test('local calculation refuses a malformed result before returning it to a caller',async()=>{
 await assert.rejects(runCalculationAction('1 / 0',registry([{expression:'1 / 0',result:Infinity,precision:'IEEE-754 binary64'}]),host,async(_tool,_input,work)=>work()),/Invalid calculation result/);
});
