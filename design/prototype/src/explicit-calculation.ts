import {calculatorInput,orderedCalculationInput} from './tools/math.calculate/tool.ts';

// Application input routing, separate from the versioned executable tool.
export function explicitCalculationInput(text:string):{expression:string;showExpression:boolean}|null {
 const direct=calculatorInput(text);if(direct!==null)return {expression:direct,showExpression:false};
 const ordered=orderedCalculationInput(text);if(ordered!==null)return {expression:ordered,showExpression:true};
 if(text.length>1000)return null;
 // Match the complete request, never search prose, files or previous turns for
 // executable text. Keep grouping/signs verbatim; only consume known UI prose.
 const wrapped=text.trim().match(/^(?:please\s+)?(?:use\s+(?:the\s+)?calculator\s+to\s+)?(?:calculate|compute|evaluate|work\s+out)\s+([\d\s.+\-*/()×÷−eE]+?)(?:,\s*(?:and\s+)?(?:give|return|show)\s+(?:just|only)\s+(?:the\s+)?(?:result|answer))?[.!?]?$/i);
 if(!wrapped)return null;
 const expression=orderedCalculationInput('Calculate '+wrapped[1].trim());
 return expression===null?null:{expression,showExpression:true};
}
