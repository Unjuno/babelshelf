export function requestNamesWorkingFile(question:string){
 return /\b(?:(?:in|from|about|within|inside|on)\s+)?(?:(?:this|that|the|current|currently\s+open(?:ed)?(?:\s+[\w-]+){0,2}|open(?:ed)?)\s+)?(?:(?:input|attached)\s+)?(?:file|note|document|memo)\b/i.test(question)
  ||/(?:この|その|当該|今(?:開いている)?|現在の|開いた)?(?:(?:入力|添付)(?:した|された)?)?(?:ファイル|メモ|ノート|文書|資料)(?:の|に|で|から|について|を|内|中)/.test(question)
  ||/(?:这(?:个|份|篇)?(?:文件|文档|笔记)|(?:文件|文档|笔记)(?:中|里|内))/.test(question)
  ||/\b(?:en|dentro de|sobre|desde)\s+(?:(?:este|esta|ese|esa|el|la|actual)\s+)?(?:archivo|documento|nota)\b/i.test(question)
  ||/\b(?:dans|sur|depuis)\s+(?:(?:ce|cette|le|la)\s+)?(?:fichier|document|note)\b/i.test(question)
  ||/\b(?:aus|über)\s+(?:(?:dieser|diese|dieses|der|die|das|aktuellen)\s+)?(?:datei|dokument|notiz)\b/i.test(question);
}
export function requestNamesEarlierDialogue(question:string){
 // Bare "before" also describes dates and arithmetic; it must not redirect a saved-note question to dialogue history.
 return /\b(?:earlier|previous(?:ly)?|last time|past conversation|conversation history|earlier message|previous message|what did (?:i|we|you) (?:say|ask|tell|decide|mention)|our conversation|chat history|my first message)\b/i.test(question)
  ||/\b(?:as (?:before|above)|same (?:way|thing|format|style)|likewise)\b|(?:同じように|同様に|前と同じ|さっきと同じ)/iu.test(question)
  ||/(?:前に|以前|さっき|先ほど|前回|前の会話|過去の会話|会話履歴|前のメッセージ|以前の発言|私が(?:言った|聞いた|話した)|話した内容|決めたこと)/.test(question)
  ||/(?:之前|以前|刚才|上次|以前的对话|历史对话|之前我说|我们讨论)/.test(question);
}
