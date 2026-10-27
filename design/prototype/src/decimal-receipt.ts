import {calculateDecimal} from './decimal-calculation.ts';

// Candidate schema: places controls recurring-decimal rounding; terminating
// values retain their exact digits (subject to evaluator limits).
export type DecimalReceipt={schema:1;expression:string;result:string;precision:'decimal';rounding:'half-even';places:18;rounded:boolean};
export function makeDecimalReceipt(expression:string):DecimalReceipt{
 const output=calculateDecimal(expression);
 return {schema:1,expression,result:output.value,precision:'decimal',rounding:'half-even',places:18,rounded:output.rounded};
}
export function validateDecimalReceipt(value:unknown):DecimalReceipt{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid decimal receipt');
 const v=value as Record<string,unknown>;
 if(Object.keys(v).sort().join(',')!=='expression,places,precision,result,rounded,rounding,schema'||v.schema!==1||typeof v.expression!=='string'||typeof v.result!=='string'||v.precision!=='decimal'||v.rounding!=='half-even'||v.places!==18||typeof v.rounded!=='boolean')throw Error('Invalid decimal receipt');
 const expected=makeDecimalReceipt(v.expression);
 if(v.result!==expected.result||v.rounded!==expected.rounded)throw Error('Invalid decimal receipt');
 return expected;
}
