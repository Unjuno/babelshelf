import {calculatorInput,orderedCalculationInput} from './tools/math.calculate/tool.ts';

// Application input routing, separate from the versioned executable tool.
export function explicitCalculationInput(text:string):{expression:string;showExpression:boolean;unit?:string}|null {
 if(text.length>1000)return null;
 // Fold only full-width arithmetic characters, not arbitrary Unicode or prose.
 // The whole-request grammars below still decide whether calculation is allowed.
 const input=text.replace(/[０-９＋－＊／（）．＝％]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xfee0));
 // Only an entire, explicitly marked arithmetic request bypasses planning.
 const japaneseCalc=input.trim().match(/^計算\s*[:：]\s*(.+)$/u);
 if(japaneseCalc){const body=japaneseCalc[1].trim();if(!/^[\d\s.+\-*/()×÷−eE=]+$/.test(body))return null;const expression=calculatorInput(body);return expression===null?null:{expression,showExpression:true};}
 // Common Japanese form, matched as the entire request so an additional
 // save/delete instruction cannot be silently dropped by the shortcut.
 const japaneseSuffix=input.trim().match(/^([\d\s.+\-*/()×÷−eE=]+?)\s*を\s*計算(?:して(?:ください|下さい)?|する|します)[。.!！?？]?$/u);
 if(japaneseSuffix){const expression=calculatorInput(japaneseSuffix[1]);return expression===null?null:{expression,showExpression:true};}
 // An explicitly denominated bill and whole-person divisor. No rounding or
 // additional action is inferred; the calculator reports its own precision.
 const split=input.replace(/，/g,',').trim().match(/^((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s*円を\s*(\d+)\s*人で割って(?:ください|下さい)?[？?。.!！]?$/u);
 if(split)return {expression:`${split[1].replace(/,/g,'')} / ${split[2]}`,showExpression:true,unit:'円/人'};
 // Match a whole unit-price question without dropping additional actions.
 const purchase=input.replace(/，/g,',').trim().match(/^((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s*円の(?:もの|品物)を\s*(\d+)\s*個買うといくら[？?。.!！]?$/u);
 if(purchase)return {expression:`${purchase[1].replace(/,/g,'')} * ${purchase[2]}`,showExpression:true,unit:'円'};
 // Two explicitly denominated yen amounts, with strictly grouped commas.
 // Full-request matching refuses additional instructions and mixed currencies.
 const yen=input.replace(/，/g,',').trim().match(/^((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s*円\s*([+\-−])\s*((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s*円[？?。.!！]?$/u);
 if(yen)return {expression:`${yen[1].replace(/,/g,'')} ${yen[2]==='−'?'-':yen[2]} ${yen[3].replace(/,/g,'')}`,showExpression:true};
 const direct=calculatorInput(input);if(direct!==null)return {expression:direct,showExpression:false};
 const ordered=orderedCalculationInput(input);if(ordered!==null)return {expression:ordered,showExpression:true};
 // Whole-request forms only: a discount is a different calculation from
 // a percentage, and mixed instructions must remain on the planning path.
 const discount=input.trim().match(/^(\d+(?:\.\d+)?)(?:円)?\s*の\s*(\d+(?:\.\d+)?)\s*%\s*引き\s*は(?:いくら)?[？?。.!！]?$/);
 if(discount)return {expression:`(${discount[1]} - (${discount[1]} * ${discount[2]} / 100))`,showExpression:true};
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
