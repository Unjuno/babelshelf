import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateDecimal} from '../src/decimal-calculation.ts';

test('decimal expressions preserve exact decimal values and precedence',()=>{
 for(const [expression,value] of [['0.1+0.2','0.3'],['9007199254740993+1','9007199254740994'],['−2.5 × (3+4)','-17.5'],['1e-3 + .002','0.003'],['1/8','0.125'],['-0+0','0']]){
  assert.deepEqual(calculateDecimal(expression),{value,rounded:false},expression);
 }
});
test('recurring division rounds half-even and reports rounding',()=>{
 assert.deepEqual(calculateDecimal('1/3',2),{value:'0.33',rounded:true});
 assert.deepEqual(calculateDecimal('5/8',2),{value:'0.62',rounded:true});
 assert.deepEqual(calculateDecimal('7/8',2),{value:'0.88',rounded:true});
 assert.deepEqual(calculateDecimal('-7/8',2),{value:'-0.88',rounded:true});
 assert.deepEqual(calculateDecimal('0.005',2),{value:'0',rounded:true});
 assert.deepEqual(calculateDecimal('0.015',2),{value:'0.02',rounded:true});
 assert.deepEqual(calculateDecimal('-0.005',2),{value:'0',rounded:true});
 assert.deepEqual(calculateDecimal('1/8',3),{value:'0.125',rounded:false});
 assert.deepEqual(calculateDecimal('0.000000000000000000001'),{value:'0.000000000000000000001',rounded:false});
});
test('invalid or unbounded arithmetic is refused',()=>{
 for(const input of ['1/0','1e9999','2**3','1;2','globalThis.x','('.repeat(33)+'1'+')'.repeat(33),'1+'.repeat(101)+'1'])assert.throws(()=>calculateDecimal(input),undefined,input);
 for(const places of [-1,101,1.5])assert.throws(()=>calculateDecimal('1/3',places));
});
