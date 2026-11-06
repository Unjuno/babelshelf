const quotedOperand='(?:「[^「」\\r\\n]*」|“[^“”\\r\\n]*”|"[^"\\r\\n]*"|\'[^\'\\r\\n]*\')';
export const unquotedCorrectionText=(text:string)=>text.replace(new RegExp(quotedOperand,'gu'),' ');
/** Parse a bounded, explicit named-file correction clause. This nominates a
 * search subject only; target selection, editability and approval stay outside. */
export function namedCorrectionClause(question:string){
 const text=question.trim();if(text.length>500||/[\r\n;；?？]/u.test(unquotedCorrectionText(text)))return null;
 const ja=/^(?:保存した|保存済みの?)(.{2,100}?)(?:の)?(?:メモ|ノート|ファイル|文書)(?:の|内の)(.{1,120}を.{1,120}に(?:直して|変更して|訂正して|修正して|変えて)(?:ください)?[。!！]?)$/u;
 const en=/^(?:in|within)\s+(?:(?:my|the)\s+)?(?:saved|stored)\s+(.{2,100}?)\s+(?:note|file|document)[,\s]+((?:please\s+)?(?:replace|change|correct|update|set)\s+.{1,120}\s+(?:to|with)\s+.{1,120}[.!]?)$/iu;
 const match=ja.exec(text)??en.exec(text);if(!match)return null;
 const command=unquotedCorrectionText(match[2]);
 if(/\b(?:and|then|also|delete|remove|send|email|upload|execute|run)\b|(?:してから|それから|削除|上書き保存|実行)/iu.test(command)||(command.match(/直して|変更して|訂正して|修正して|変えて/gu)?.length??0)>1)return null;
 const query=match[1].trim();return query&&!/[。!?！？]/u.test(query)?{query,instruction:match[2]}:null;
}

/** Only paired quoted operands are literal. Preserve their Unicode/whitespace
 * exactly; unquoted or compound semantic instructions remain model work. */
export function explicitLiteralReplacement(question:string):{action:'replace';find:string;with:string}|null{
 const text=question.trim();if(!text||text.length>30000)return null;
 let clause=namedCorrectionClause(text)?.instruction??text;
 clause=clause.replace(/^(?:この|その|今開いている|現在の)(?:ファイル|メモ|ノート|文書)(?:の|内の)/u,'').replace(/^(?:in|within)\s+(?:this|the\s+current)\s+(?:file|note|document)[,\s]+/iu,'');
 const quoted=quotedOperand;
 const ja=new RegExp('^('+quoted+')を('+quoted+')に(?:直して|変更して|訂正して|修正して|変えて|置き換えて)(?:ください)?[。!！]?$','u');
 const en=new RegExp('^(?:please\\s+)?replace\\s+('+quoted+')\\s+with\\s+('+quoted+')(?:\\s+in\\s+(?:this|the\\s+current)\\s+(?:file|note|document))?[.!]?$','iu');
 const match=ja.exec(clause)??en.exec(clause);if(!match)return null;
 const find=match[1].slice(1,-1),replacement=match[2].slice(1,-1);
 if(!find.length)throw Error('Replacement search text is empty');
 return {action:'replace',find,with:replacement};
}

/** A bounded from/to instruction is usable only when both operands are explicit
 * and the named original occurs exactly once. Review remains mandatory. */
export function explicitFromToReplacement(question:string,body:string):{action:'replace';find:string;with:string}|null{
 const text=question.trim();if(text.length>500||/[\r\n;；?？]/u.test(text))return null;
 const match=/^(?:この|その|今開いている|現在の)(?:ファイル|メモ|ノート|文書)の([\p{L}\p{N}・ー]{1,32})を([\p{L}\p{N}・ー]{1,32}?)から([\p{L}\p{N}・ー]{1,32}?)に(?:直して|変更して|訂正して|修正して|変えて)(?:ください|下さい)?(?:。([\p{L}\p{N}・ー]{1,32})(?:は|を)(?:変えないで|変更しないで|そのままにして)(?:ください|下さい)?)?[。！!]?$/u.exec(text);
 if(!match||/(?:削除|保存|送信|実行|検索|追加|作成|上書き)/u.test(text)||match[2]===match[3])return null;
 const [subject,find,replacement,preserved]=match.slice(1),first=body.indexOf(find);if(first<0||body.indexOf(find,first+1)!==-1)return null;
 const sentence=body.slice(0,first).split(/[。！？!?\r\n]/u).at(-1)!+body.slice(first).split(/[。！？!?\r\n]/u)[0];
 if(!sentence.includes(subject)||preserved&&sentence.includes(preserved))return null;
 return {action:'replace',find,with:replacement};
}
