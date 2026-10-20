// An explicitly named saved source is distinct from a deictic reference to
// the currently opened file. This identifies a read scope, never permission.
export function namesSavedKnowledge(text:string){
 return /\b(?:saved|stored|my)\s+(?:(?:[\p{L}\p{N}-]+)\s+){0,8}(?:notes?|files?|documents?|records?)\b/iu.test(text)
  ||/(?:保存した|保存済み|自分の|私の).{0,40}(?:メモ|ノート|ファイル|文書|記録)/u.test(text);
}

export function namesExplicitSavedKnowledge(text:string){
 return /\b(?:saved|stored)\s+(?:(?:[\p{L}\p{N}-]+)\s+){0,8}(?:notes?|files?|documents?|records?)\b/iu.test(text)
  ||/(?:保存した|保存済み).{0,40}(?:メモ|ノート|ファイル|文書|記録)/u.test(text);
}

export function namesDeicticFile(text:string){
 return /\b(?:this|that|current|opened)\s+(?:file|note|document|memo)\b/i.test(text)
  ||/(?:この|その|今(?:開いている)?|現在の|開いた)(?:ファイル|メモ|ノート|文書|資料)/u.test(text);
}
