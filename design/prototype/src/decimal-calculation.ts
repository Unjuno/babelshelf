// Standalone candidate: this is not yet connected to the versioned tool.
// Fractions use bounded BigInts, and rounded results use ties-to-even.
type Fraction={n:bigint;d:bigint};
const abs=(n:bigint)=>n<0n?-n:n;
function gcd(a:bigint,b:bigint):bigint{a=abs(a);b=abs(b);while(b){const t=a%b;a=b;b=t;}return a;}
function fraction(n:bigint,d:bigint):Fraction{
 if(!d)throw Error('Cannot divide by zero');
 if(abs(n).toString().length>512||abs(d).toString().length>512)throw Error('Calculation out of range');
 if(d<0n){n=-n;d=-d;}const g=gcd(n,d);return {n:n/g,d:d/g};
}
export function calculateDecimal(expression:string,places?:number):{value:string;rounded:boolean}{
 if(typeof expression!=='string'||!expression.trim()||expression.length>200||places!==undefined&&(!Number.isInteger(places)||places<0||places>100))throw Error('Invalid calculation');
 const source=expression.replace(/×/g,'*').replace(/÷/g,'/').replace(/−/g,'-');let pos=0,depth=0;
 const space=()=>{while(pos<source.length&&/\s/u.test(source[pos]))pos++;};
 function atom():Fraction{
  space();if(++depth>32)throw Error('Calculation nesting limit');let out:Fraction;const c=source[pos];
  if(c==='+'||c==='-'){pos++;const v=atom();out=c==='-'?fraction(-v.n,v.d):v;}
  else if(c==='('){pos++;out=sum();space();if(source[pos++]!==')')throw Error('Invalid calculation');}
  else{
   const m=/^(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?/.exec(source.slice(pos));if(!m)throw Error('Invalid calculation');
   pos+=m[0].length;const digits=(m[1]??'0')+(m[2]??m[3]??'');const exponent=Number(m[4]??0)-(m[2]??m[3]??'').length;
   if(!Number.isSafeInteger(exponent)||Math.abs(exponent)>100)throw Error('Calculation out of range');
   const n=BigInt(digits);out=exponent>=0?fraction(n*10n**BigInt(exponent),1n):fraction(n,10n**BigInt(-exponent));
  }
  depth--;return out;
 }
 function product():Fraction{let v=atom();space();while(source[pos]==='*'||source[pos]==='/'){const op=source[pos++],r=atom();v=op==='*'?fraction(v.n*r.n,v.d*r.d):fraction(v.n*r.d,v.d*r.n);space();}return v;}
 function sum():Fraction{let v=product();space();while(source[pos]==='+'||source[pos]==='-'){const op=source[pos++],r=product();v=fraction(v.n*r.d+(op==='+'?1n:-1n)*r.n*v.d,v.d*r.d);space();}return v;}
 const result=sum();space();if(pos!==source.length)throw Error('Invalid calculation');
 let denominator=result.d,twos=0,fives=0;while(denominator%2n===0n){denominator/=2n;twos++;}while(denominator%5n===0n){denominator/=5n;fives++;}
 const exactPlaces=denominator===1n?Math.max(twos,fives):null;
 const scale=places??(exactPlaces===null?18:exactPlaces);if(scale>100)throw Error('Calculation out of range');
 const factor=10n**BigInt(scale),scaled=abs(result.n)*factor,quotient=scaled/result.d,remainder=scaled%result.d;
 const rounded=remainder!==0n,up=remainder*2n>result.d||(remainder*2n===result.d&&quotient%2n===1n),integer=quotient+(up?1n:0n);
 let digits=integer.toString().padStart(scale+1,'0'),value=scale?digits.slice(0,-scale)+'.'+digits.slice(-scale):digits;
 if(scale)value=value.replace(/0+$/,'').replace(/\.$/,'');if(result.n<0n&&integer!==0n)value='-'+value;
 return {value,rounded};
}
