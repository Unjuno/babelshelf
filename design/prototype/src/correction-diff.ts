export type DiffPart={text:string;changed:boolean};
// Bounded character diff for review only; never changes the proposal bytes.
export function correctionDiff(before:string,after:string):{before:DiffPart[];after:DiffPart[];highlighted:boolean}{
 const a=Array.from(before),b=Array.from(after),width=b.length+1;
 if((a.length+1)*width>500000)return {before:[{text:before,changed:false}],after:[{text:after,changed:false}],highlighted:false};
 const table=new Uint16Array((a.length+1)*width);
 for(let i=a.length-1;i>=0;i--)for(let j=b.length-1;j>=0;j--)table[i*width+j]=a[i]===b[j]?1+table[(i+1)*width+j+1]:Math.max(table[(i+1)*width+j],table[i*width+j+1]);
 const left:DiffPart[]=[],right:DiffPart[]=[];
 const add=(parts:DiffPart[],text:string,changed:boolean)=>{const last=parts.at(-1);if(last&&last.changed===changed)last.text+=text;else parts.push({text,changed});};
 let i=0,j=0;while(i<a.length||j<b.length){
  if(i<a.length&&j<b.length&&a[i]===b[j]){add(left,a[i],false);add(right,b[j],false);i++;j++;}
  else if(j<b.length&&(i===a.length||table[i*width+j+1]>table[(i+1)*width+j]))add(right,b[j++],true);
  else add(left,a[i++],true);
 }
 return {before:left,after:right,highlighted:true};
}
