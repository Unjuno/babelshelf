import {explicitCalculationInput} from './explicit-calculation.ts';
import {formatCalculation} from './calculation-action.ts';
import {validateDecimalReceipt,type DecimalReceipt} from './tools/math.calculate/decimal-receipt.ts';

/** Validate the receipt against the complete scheduled prompt and displayed answer. */
export function validateScheduledCalculation(prompt:string,answer:string,receipt:unknown):DecimalReceipt{
 const input=explicitCalculationInput(prompt);if(!input)throw Error('Invalid scheduled calculation');
 const checked=validateDecimalReceipt(receipt);if(checked.expression!==input.expression||formatCalculation(checked,input.showExpression?input.expression:undefined,input.unit)!==answer)throw Error('Invalid scheduled calculation');
 return checked;
}
