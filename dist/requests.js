// Convenient literal routes work without a model. Other languages/phrasing use Bonsai.
export function localRequest(text){
 const task=text.match(/^(answer|summarize|回答|要約)\s*[:：]\s*([\s\S]+)$/i);if(task)return {action:/^(summarize|要約)$/i.test(task[1])?'summary':'answer',query:task[2]};
 const capture=text.match(/^(?:記録(?:して)?|メモ(?:して)?|覚えて|保存して|remember|record|note|save a note)(?:[ \t]*[:：][ \t]*|\s+)([\s\S]+)$/i);
 if(capture?.[1].trim())return {action:'capture',body:capture[1]};
 const match=text.match(/^(search|find|検索|探して|read|open|読んで|開いて)\s*[:：]?\s+([\s\S]+)$|^(検索|探して|読んで|開いて)[:：]([\s\S]+)$/i);
 if(match){const op=match[1]??match[3];return {action:/^(read|open|読んで|開いて)$/i.test(op)?'read':'search',query:match[2]??match[4]};}return null;
}
