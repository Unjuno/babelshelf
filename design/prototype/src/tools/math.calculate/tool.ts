import type {ToolHost} from '../tool-host.ts';
export const definition=Object.freeze({id:'math.calculate',version:2,readOnly:true,network:'none',inputSchema:{type:'object',required:['expression'],additionalProperties:false,properties:{expression:{type:'string',minLength:1,maxLength:200}}}});
// Only whole, explicit arithmetic inputs bypass planning. No document or history scan.
export function calculatorInput(text:string):string|null {
 if(/^\d{4}-\d{2}-\d{2}$/.test(text.trim()))return null;
 const value=text.trim().replace(/^calc(?:ulate)?\s*:\s*/i,'').replace(/＝/g,'=').replace(/=\s*$/,'').trim();
 return value && /^[\d\s.+\-*/()×÷−eE]+$/.test(value) && /\d/.test(value) && /[+*/×÷]|\d\s*[-−]/.test(value)?value:null;
}
export function calculate(expression:string):number {
 if(typeof expression!=='string'||!expression.trim()||expression.length>1000)throw Error('Invalid calculation');
 const source=expression.replace(/×/g,'*').replace(/÷/g,'/').replace(/−/g,'-');let pos=0,depth=0;
 const space=()=>{while(/\s/.test(source[pos]??'')&&pos<source.length)pos++;};
 const finite=(n:number)=>{if(!Number.isFinite(n))throw Error('Calculation out of range');return n;};
 function atom():number {space();if(++depth>32)throw Error('Calculation nesting limit');let n:number;
  const c=source[pos];if(c==='+'||c==='-'){pos++;n=(c==='-'?-1:1)*atom();}
  else if(c==='('){pos++;n=sum();space();if(source[pos++]!==')')throw Error('Invalid calculation');}
  else {const match=source.slice(pos).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);if(!match)throw Error('Invalid calculation');pos+=match[0].length;n=Number(match[0]);}
  depth--;return finite(n);
 }
 function product():number {let n=atom();space();while(source[pos]==='*'||source[pos]==='/'){const op=source[pos++],rhs=atom();if(op==='/'&&rhs===0)throw Error('Cannot divide by zero');n=finite(op==='*'?n*rhs:n/rhs);space();}return n;}
 function sum():number {let n=product();space();while(source[pos]==='+'||source[pos]==='-'){const op=source[pos++],rhs=product();n=finite(op==='+'?n+rhs:n-rhs);space();}return n;}
 const result=sum();space();if(pos!==source.length)throw Error('Invalid calculation');return Object.is(result,-0)?0:result;
}
export async function run(args:unknown,host:ToolHost){
 if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).length!==1||!Object.hasOwn(args,'expression'))throw Error('Invalid tool arguments');
 host.check();const expression=(args as {expression:string}).expression,result=calculate(expression);host.check();
 return [{expression,result,precision:'IEEE-754 binary64'}];
}
// A whole-request finite grammar, not a scan of arbitrary prose or a repair of
// model output. Each explicit "then" folds the previous result as one operand.
export function orderedCalculationInput(text:string):string|null {
 if(text.length>1000)return null;
 const japanese=text.trim().replace(/[。！？!?]$/,'');
 const japaneseNumber='([+−-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?)';
 const japaneseForms:[RegExp,string][]=[
  [new RegExp('^'+japaneseNumber+'\\s*と\\s*'+japaneseNumber+'\\s*を(?:足して|足す|足します)$'),'+'],
  [new RegExp('^'+japaneseNumber+'\\s*から\\s*'+japaneseNumber+'\\s*を(?:引いて|引く|引きます)$'),'-'],
  [new RegExp('^'+japaneseNumber+'\\s*に\\s*'+japaneseNumber+'\\s*を(?:掛けて|掛ける|掛けます|かけて|かける)$'),'*'],
  [new RegExp('^'+japaneseNumber+'\\s*を\\s*'+japaneseNumber+'\\s*で(?:割って|割る|割ります)$'),'/'],
 ];
 for(const [pattern,operator] of japaneseForms){const match=japanese.match(pattern);if(match)return `(${match[1]} ${operator} ${match[2]})`;}
 const clauses=text.trim().replace(/[.!?]$/,'').split(/\s*,?\s+then\s+/i);if(clauses.length>16)return null;
 const number='[+−-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?',numeric=new RegExp('^'+number+'$');
 const first=clauses[0].trim();let expression:string|null=null;
 const total=first.match(/^(?:calculate\s+(?:the\s+)?(?:sum|total)\s+of|add)\s+(.+)$/i);
 if(total){const terms=total[1].split(/\s+and\s+/i);if(terms.length<2||terms.length>16||terms.some(term=>!numeric.test(term)))return null;expression='('+terms.join(' + ')+')';}
 else {
  const binary=first.match(new RegExp('^(subtract|multiply|divide)\\s+('+number+')\\s+(from|by)\\s+('+number+')$','i'));
  if(binary){const [,verb,left,link,right]=binary;if(verb.toLowerCase()==='subtract'){if(link.toLowerCase()!=='from')return null;expression='('+right+' - '+left+')';}else{if(link.toLowerCase()!=='by')return null;expression='('+left+(verb.toLowerCase()==='multiply'?' * ':' / ')+right+')';}}
  else {const calculation=first.match(/^calculate\s+(.+)$/i);if(!calculation)return null;expression=calculatorInput(calculation[1])??(numeric.test(calculation[1])?calculation[1]:null);}
 }
 if(expression===null)return null;
 for(const clause of clauses.slice(1)){const step=clause.trim().match(new RegExp('^(add|subtract|multiply by|divide by)\\s+('+number+')$','i'));if(!step)return null;const op=({'add':'+','subtract':'-','multiply by':'*','divide by':'/'} as Record<string,string>)[step[1].toLowerCase()];expression='('+expression+' '+op+' '+step[2]+')';}
 return expression;
}
