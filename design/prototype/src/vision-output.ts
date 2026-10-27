/** Reject the observed runaway numeric index sequence, not ordinary image text. */
export function validateVisionOutput(text:string):string {
 const value=text.trim();if(!value)throw Error('Vision model returned no description');
 const tokens=value.split(/\s+/u);
 if(tokens.length>=32&&tokens.every(token=>/^\d{1,6}$/u.test(token))&&tokens.every((token,index)=>index===0||Number(token)===Number(tokens[index-1])+1))throw Error('Image description invalid · try again');
 return value;
}
