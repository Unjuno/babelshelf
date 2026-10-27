import {calculatorInput,orderedCalculationInput} from './tools/math.calculate/tool.ts';

// Application input routing, separate from the versioned executable tool.
export function explicitCalculationInput(text:string):{expression:string;showExpression:boolean}|null {
 if(text.length>1000)return null;
 // Fold only full-width arithmetic characters, not arbitrary Unicode or prose.
 // The whole-request grammars below still decide whether calculation is allowed.
 const input=text.replace(/[０-９＋－＊／（）．＝％]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xfee0));
 const direct=calculatorInput(input);if(direct!==null)return {expression:direct,showExpression:false};
 const ordered=orderedCalculationInput(input);if(ordered!==null)return {expression:ordered,showExpression:true};
 // Only an entire, unambiguous "what is X percent of Y" question. In
 // particular, a discount, tax-inclusive price, or instruction to save is
 // not equivalent and must remain on the normal planning path.
 const percent=input.trim().match(/^(\d+(?:\.\d+)?)(?:円)?\s*の\s*(\d+(?:\.\d+)?)\s*%\s*は(?:いくら)?[？?。.!！]?$/);
 if(percent)return {expression:`(${percent[1]} * ${percent[2]} / 100)`,showExpression:true};
 const englishPercent=input.trim().match(/^what\s+is\s+(\d+(?:\.\d+)?)\s*(?:%|percent)\s+of\s+(\d+(?:\.\d+)?)[?.!]?$/i);
 if(englishPercent)return {expression:`(${englishPercent[2]} * ${englishPercent[1]} / 100)`,showExpression:true};
 // Match the complete request, never search prose, files or previous turns for
 // executable text. Keep grouping/signs verbatim; only consume known UI prose.
 const wrapped=input.trim().match(/^(?:please\s+)?(?:use\s+(?:the\s+)?calculator\s+to\s+)?(?:calculate|compute|evaluate|work\s+out)\s+([\d\s.+\-*/()×÷−eE]+?)(?:,\s*(?:and\s+)?(?:give|return|show)\s+(?:just|only)\s+(?:the\s+)?(?:result|answer))?[.!?]?$/i);
 if(!wrapped)return null;
 const expression=orderedCalculationInput('Calculate '+wrapped[1].trim());
 return expression===null?null:{expression,showExpression:true};
}
