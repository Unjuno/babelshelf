import {runBuiltinTool,type CalculationToolResult} from './tools/builtin-tool-results.ts';
import type {ToolHost} from './tools/tool-host.ts';
import type {createToolRegistry} from './tools/tool-registry.ts';
import {validateDecimalReceipt} from './tools/math.calculate/decimal-receipt.ts';
import type {DialogueTurn} from './conversation.ts';
import {explicitCalculationInput} from './explicit-calculation.ts';

type CalculationRegistry=Pick<ReturnType<typeof createToolRegistry>,'identity'|'run'>;
type CalculationTrace=<T>(tool:'math.calculate',input:unknown,work:()=>Promise<T>)=>Promise<T>;

/** A model-proposed expression is not proof of where its operands came from. */
export function needsSourcedCalculationReview(question:string,previous:DialogueTurn|undefined):boolean {
 return !!previous?.refs?.length&&/(?:その|これ|あれ|先ほど|さっき|直前|以前|前の|メモ|ノート|ファイル|原文|引用|\b(?:that|this|those|these|previous|earlier|above|note|file|source)\b)/iu.test(question);
}
/** Narrow admission to reviewed source arithmetic, not an answer or an operand. */
export function isSourcedArithmeticQuestion(question:string,previous:DialogueTurn|undefined):boolean{
 if(!needsSourcedCalculationReview(question,previous)||question.length>500)return false;
 if(/(?:保存|削除|変更|修正|訂正|編集|上書|通知|予定|送信|\b(?:save|delete|edit|change|schedule|send)\b)/iu.test(question))return false;
 return /(?:分け|割(?:る|って|り|れ)|足(?:す|して|し)|引(?:く|いて|き)|掛(?:ける|けて|け)|かける|計算|\b(?:divide|split|share|multiply|calculate|subtract|add)\b)/iu.test(question);
}

/** Keep explicit and planned arithmetic on the same registered, traced, typed local-tool path. */
export async function runCalculationAction(expression:string,registry:CalculationRegistry,host:ToolHost,trace:CalculationTrace){
 const identity=await registry.identity('math.calculate');
 return trace('math.calculate',{expression,...identity},()=>runBuiltinTool(registry,'math.calculate',{expression},host));
}

/** Display the approximation marker once, whether or not the expression is shown. */
export function formatCalculation(item:CalculationToolResult,expression?:string,unit?:string){
 const approximate=item.precision==='decimal'&&item.rounded;
 return (expression?expression+(approximate?' ≈ ':' = '):approximate?'≈ ':'')+String(item.result)+(unit?' '+unit:'');
}

/** A continuation may only use one validated, exact calculator receipt. */
function exactPreviousReceipt(previous:DialogueTurn|undefined){
 if(previous?.status!=='Calculated'||previous.attachments?.length||previous.refs?.length)return null;
 const receipts=previous.activity?.filter(item=>item.tool==='math.calculate'&&item.status==='succeeded')??[];
 if(receipts.length!==1||!Array.isArray(receipts[0].output)||receipts[0].output.length!==1)return null;
 try{const receipt=validateDecimalReceipt(receipts[0].output[0]);return receipt.rounded?null:receipt;}catch{return null;}
}

/** Only the immediately preceding, exact local-calculator receipt can bind
 * this narrow follow-up; arbitrary assistant text is not a numeric source. */
export function continuedCalculationInput(text:string,previous:DialogueTurn|undefined):string|null {
 const request=text.normalize('NFKC').trim();
 const number='([+\\-]?(?:\\d+(?:\\.\\d+)?|\\.\\d+))',ending='(?:ください|下さい)?[。.!！?？]?$';
 const forms:[RegExp,string][]=[
  [new RegExp('^その結果を\\s*'+number+'\\s*で割って'+ending,'u'),'/'],
  [new RegExp('^その結果に\\s*'+number+'\\s*を足して'+ending,'u'),'+'],
  [new RegExp('^その結果から\\s*'+number+'\\s*を引いて'+ending,'u'),'-'],
  [new RegExp('^その結果に\\s*'+number+'\\s*を(?:掛けて|かけて)'+ending,'u'),'*'],
  [new RegExp('^(?:(?:now|then|and then)\\s+)?(?:please\\s+)?(?:divide|split)\\s+(?:that|this|it|the result)\\s+by\\s*'+number+ending,'i'),'/'],
  [new RegExp('^(?:(?:now|then|and then)\\s+)?(?:please\\s+)?add\\s*'+number+'\\s+to\\s+(?:that|this|it|the result)'+ending,'i'),'+'],
  [new RegExp('^(?:(?:now|then|and then)\\s+)?(?:please\\s+)?subtract\\s*'+number+'\\s+from\\s+(?:that|this|it|the result)'+ending,'i'),'-'],
  [new RegExp('^(?:(?:now|then|and then)\\s+)?(?:please\\s+)?multiply\\s+(?:that|this|it|the result)\\s+by\\s*'+number+ending,'i'),'*'],
 ];
 const selected=forms.map(([pattern,operator])=>({match:request.match(pattern),operator})).find(item=>item.match);
 const match=selected?.match;
 if(!match||!previous)return null;
 const receipt=exactPreviousReceipt(previous);if(!receipt)return null;
 if(previous.answer!==formatCalculation(receipt)&&previous.answer!==formatCalculation(receipt,receipt.expression))return null;
 return `${receipt.result} ${selected!.operator} ${match[1]}`;
}

/** Continue a unit-bearing purchase calculation only when its original request,
 * exact receipt and displayed answer agree. Dividing by a scalar preserves yen. */
export function continuedYenCalculation(text:string,previous:DialogueTurn|undefined):{expression:string;unit:string}|null {
 const match=text.normalize('NFKC').trim().match(/^その結果を\s*([+\-]?(?:\d+(?:\.\d+)?|\.\d+))\s*で割って(?:ください|下さい)?[。.!！?？]?$/u);
 if(!match||!previous)return null;
 const original=explicitCalculationInput(previous.user);if(!original||original.unit!=='円')return null;
 const receipt=exactPreviousReceipt(previous);if(!receipt||receipt.expression!==original.expression||previous.answer!==formatCalculation(receipt,original.expression,'円'))return null;
 return {expression:`${receipt.result} / ${match[1]}`,unit:'円'};
}
