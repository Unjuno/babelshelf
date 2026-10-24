/** Shared bounded output allowance for reviewed edits and inert tool drafts.
 * Callers must count the exact messages and generation format with the selected
 * engine. This neither truncates source nor grants permission to save output.
 */
export function proposalOutputTokens(promptTokens:number,contextTokens:number,maximum=4096):number{
 if(!Number.isSafeInteger(promptTokens)||promptTokens<0||!Number.isSafeInteger(contextTokens)||contextTokens<1||!Number.isSafeInteger(maximum)||maximum<256||maximum>4096)throw Error('Invalid token budget · original retained');
 const available=Math.min(maximum,contextTokens-promptTokens-160);
 if(available<256)throw Error('Input exceeds context limit · original retained');
 return available;
}
