// Convenient literal routes work without a model. Other languages/phrasing use Bonsai.
export function localRequest(text){
 const capture=text.match(/^(?:記録|メモ|覚えて|保存して|remember|record|note|save a note)\s*[:：]?\s+([\s\S]+)$|^(?:記録|メモ|覚えて|保存して)[:：]([\s\S]+)$/i);
 if(capture)return {action:'capture',body:capture[1]??capture[2]};
 const match=text.match(/^(search|find|検索|探して|read|open|読んで|開いて)\s*[:：]?\s+([\s\S]+)$|^(検索|探して|読んで|開いて)[:：]([\s\S]+)$/i);
 if(match){const op=match[1]??match[3];return {action:/^(read|open|読んで|開いて)$/i.test(op)?'read':'search',query:match[2]??match[4]};}return null;
}
