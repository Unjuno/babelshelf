import type {ToolHost} from '../tool-host.ts';
export const definition=Object.freeze({id:'math.calculate',version:1,readOnly:true,network:'none'});
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
