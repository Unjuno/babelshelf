import test from 'node:test';
import assert from 'node:assert/strict';
import {makeDecimalReceipt,validateDecimalReceipt} from '../src/tools/math.calculate/decimal-receipt.ts';

test('decimal receipts preserve exact strings and disclose rounding',()=>{
 const exact=makeDecimalReceipt('9007199254740993+0.1');
 assert.deepEqual(exact,{schema:1,expression:'9007199254740993+0.1',result:'9007199254740993.1',precision:'decimal',rounding:'half-even',places:18,rounded:false});
 assert.deepEqual(validateDecimalReceipt(exact),exact);
 assert.deepEqual(validateDecimalReceipt(makeDecimalReceipt('1/3')).rounded,true);
});
test('receipt validation recomputes results and rejects extra fields and tampering',()=>{
 const value=makeDecimalReceipt('1/3');
 for(const changed of [{...value,result:'0.3'},{...value,rounded:false},{...value,expression:'1/4'},{...value,rounding:'down'},{...value,places:19},{...value,extra:true},null])assert.throws(()=>validateDecimalReceipt(changed));
});
