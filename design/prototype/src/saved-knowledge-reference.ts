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

// A saved item can be named without putting "note" next to its name:
// "the saved blue lantern meeting? Cite the note." The latter sentence
// requests a citation; it does not switch the target to the opened file.
export function namedSavedSubject(question:string){
 if(!/\b(?:cite|source)\s+(?:(?:the|this|that)\s+)?(?:note|file|document|record)\b/i.test(question))return null;
 return /\b(?:saved|stored)\s+((?:[\p{L}\p{N}-]+\s*){1,8})(?=[?？.!])/iu.exec(question)?.[1]??null;
}

export function namesDeicticFile(text:string){
 return /\b(?:this|that|current|opened)\s+(?:file|note|document|memo)\b/i.test(text)
  ||/(?:この|その|今(?:開いている)?|現在の|開いた)(?:ファイル|メモ|ノート|文書|資料)/u.test(text);
}
