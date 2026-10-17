// Recovery stages a draft only; no execution, persistence or mutation authority.
export function recoverSubmittedInput<T extends {asset?:unknown;file?:unknown;prepared?:unknown;reviewedText?:unknown}>(current:{text:string;attachments:unknown[]},submitted:{text:string;attachments:T[]}|null):{text:string;attachments:T[]}|null {
 if(!submitted||current.text.length||current.attachments.length)return null;
 if(submitted.attachments.some(a=>!a.asset||a.file!==undefined||a.prepared!==undefined||a.reviewedText!==undefined))throw Error('Submitted originals unavailable');
 return {text:submitted.text,attachments:submitted.attachments.map(a=>({...a}))};
}
