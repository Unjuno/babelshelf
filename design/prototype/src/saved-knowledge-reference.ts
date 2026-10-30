// An explicitly named saved source is distinct from a deictic reference to
// the currently opened file. This identifies a read scope, never permission.
// File extensions name saved originals without requiring a later noun such as
// "notes" or メモ; long lists of filenames otherwise miss the bounded noun rule.
const explicitSavedFilename=/(?:\b(?:saved|stored)\s+|(?:保存した|保存済み(?:の)?)\s*)["'「『“]?[\p{L}\p{N}_./\\-]+\.(?:md|markdown|txt|pdf|docx?|rtf)\b/iu;
// A named hierarchy path also identifies a knowledge scope without the user
// having to prepend "saved". URLs and OS drive paths are not Memory selectors.
// This only scopes working context; lookup still verifies that a file exists.
const explicitMemoryPath=/(?:^|[\s"'「『“(=])\/?(?:[\p{L}\p{M}\p{N}_.-]+[/\\])+[\p{L}\p{M}\p{N}_.-]+\.(?:md|markdown|txt|pdf|docx?|rtf)\b/iu;
export function namesSavedKnowledge(text:string){
 return explicitSavedFilename.test(text)||/\b(?:saved|stored|my)\s+(?:(?:[\p{L}\p{N}-]+)\s+){0,8}(?:notes?|files?|documents?|records?)\b/iu.test(text)
  ||/(?:保存した|保存済み|自分の|私の).{0,40}(?:メモ|ノート|ファイル|文書|記録)/u.test(text);
}

/** A submitted source and a saved source belong in the same agent turn. This
 * detects the mixed scope so attachment-only shortcuts do not bypass tools. */
export function requestsCrossSource(text:string){
 const saved=namesExplicitSavedKnowledge(text)||/\bmy\s+(?!(?:current|this|that|open|opened|working)\b)(?:(?:[\p{L}\p{N}-]+\s+){0,6})(?:notes?|files?|documents?|records?)\b/iu.test(text)||/(?:自分の|私の)(?!現在の|今開いている).{0,30}(?:メモ|ノート|ファイル|文書|記録)/u.test(text);
 const current=/\b(?:this|these|attached|current|open|opened)\b.{0,36}\b(?:files?|notes?|documents?|pdfs?|images?|audio|videos?|attachments?)\b/iu.test(text)||/(?:この|添付(?:した|された)?|今開いている)(?:ファイル|メモ|ノート|文書|PDF|画像|音声|動画|添付)/u.test(text);
 const operation=/\b(?:compare|contrast|reconcile|cross[ -]?reference|relate|match|combine|alongside|against|with)\b|(?:比較|対比|照合|突き合わせ|照らし合わせ|関連付け|合わせて|一緒に|と比べ|との違い)/iu.test(text);
 return saved&&(current||operation);
}

const localizedSearch=/\b(?:buscar|busca|busque|pesquise|procure|cerca|ricerca|cherche|recherche|chercher|suche|durchsuche|wyszukaj|znajdź)\b|(?:ابحث|البحث|搜索|查找|检索|검색|tìm|tra\s+cứu|cari|telusuri|खोज|найди|ищи|поиск|ค้นหา)/iu;
const localizedMemory=/\b(?:memory|notes?|files?)\b|(?:الذاكرة|ملاحظات|记忆|笔记|文件|文档|mémoire|datei|notizen?|gedächtnis|speicher|memoria|appunti|archivos?|documentos?|memória|arquivos?|메모리|노트|파일|bộ\s+nhớ|ghi\s+chú|memori|catatan|स्मृति|नोट्स?|памяти|заметки|память|pamięci|notatki|ความจำ|บันทึก)/iu;
const localizedAnswer=/(?:أخبرني|اخبرني|قل\s+لي|أجب|告诉我|回答|说明|指出|dis[- ]?moi|dites[- ]?moi|réponds|erkläre|sag\s+mir|nenne\s+mir|dimmi|indicami|rispondimi|dime|indícame|respóndeme|me\s+diga|diga[- ]?me|informe[- ]?me|알려줘|말해줘|답해줘|cho\s+tôi\s+biết|cho\s+biết|trả\s+lời|beri\s+tahu|beritahu|jelaskan|jawab|बताइए|बताएं|बताओ|जवाब|ответь|скажи|расскажи|назови|powiedz\s+mi|odpowiedz|podaj|บอกฉัน|บอก|ตอบ)/iu;
const localizedRead=/(?:اقرأ|إقرأ|افتح|راجع|阅读|打开|读取|讀取|閱讀|lire|lis|ouvre|consulte|lies|öffne|lese|apr[ií]|leggi|lee|leia|ler|읽어|열어|đọc|mở|baca|membaca|पढ़ें|पढ़ो|прочитай|открой|czytaj|otwórz|อ่าน|เปิด)/iu;
const localizedMoreWork=/(?:مقارنة|قارن|احسب|比较|对比|计算|合计|compar\p{L}*|compár\p{L}*|vergleichen|berechnen|confrontare|confronta|calcular|calcule|vergelijk|비교|계산|so\s+sánh|tính|bandingkan|hitung|तुलना|गणना|сравни|рассчитай|сравнить|oblicz|porównaj|เปรียบเทียบ|คำนวณ)/iu;

// Conservative veto for read-to-answer shortcuts, not an intent or permission
// decision. Clause order must not erase requested saving/editing/other work;
// ambiguous wording can safely stay with the agent's next planning step.
const additionalAction=/\b(?:save|store|create|write|edit|update|change|rewrite|delete|remove|send|email|upload|download|export|schedule|notify)\b|(?:保存|記録|作成|編集|訂正|修正|更新|変更|削除)(?!済み|された|した(?!い))|(?:送信|書き出|書出|予定|通知)/iu;

/** Keep an explicit local search + source read + answer request on the
 * text-agent route. A one-shot decision label cannot represent these stages;
 * the agent can choose the operation order while the host checks completion. */
export function requestsLocalSearchReadAnswer(text:string){
 // A narrowly phrased verification request still requires retrieve -> read ->
 // answer even when it uses “check/confirm” instead of naming each tool step.
 // Keep the subject and Memory anchor bounded so this does not capture generic
 // checks or unrelated confirmations.
 const checkedMemoryRecord=/\b(?:check|verify|confirm)\s+(?:(?:the|my|saved|stored|local|exact)\s+){0,4}(?:(?:[\p{L}\p{N}-]+)\s+){1,6}(?:notes?|files?|documents?|records?)\s+(?:in|from)\s+(?:my\s+)?memory\b/iu.exec(text);
 const search=checkedMemoryRecord||/(?:\b(?:search(?:\s+for)?|find|look\s+for|look\s+up|locate|retrieve)\s+(?:(?:the|my|a|saved|stored|local|matching|relevant|exact)\s+){0,5}(?:memory|notes?|files?|documents?|records?)\b|\bsearch\s*[,;]\s*(?:then\s+)?|検索(?:し(?:て|、|,|た)?|を実行して)|探し(?:て|出して)|見つけ(?:て|出して))/iu.exec(text);
 const read=checkedMemoryRecord||/(?:\b(?:read|open|inspect)\s+(?:(?:the|this|that|my|matching|relevant|exact|full|complete|saved|local)\s+){0,4}(?:file|notes?|documents?|records?|source|result|contents?)\b|\b(?:read|open|inspect)\s+(?:it|them)\b|\b(?:read|open|inspect)\s+[\w./\\-]+\.(?:md|markdown|txt|pdf|docx?|rtf)\b|\bread\s*(?:[,;]|\bthen\b)|(?:読んで|読み込んで|読み取って|開いて|目を通して|内容を確認して))/iu.exec(text)||localizedRead.test(text);
 const answer=/(?:\b(?:tell\s+me|answer|report|explain|identify|summari[sz]e|confirm|verify)\b|教えて|答えて|報告して|説明して|特定して|要約して)/iu.exec(text);
 if(localizedSearch.test(text)&&localizedMemory.test(text)&&localizedAnswer.test(text))return true;
 // Users often say “search Memory and tell me …” without naming the internal
 // read step. A single unambiguous hit still needs to be opened before the
 // answer can be grounded; the coordinator performs that read explicitly.
 const explicitSavedFileSearch=/\b(?:find|look\s+(?:for|up)|locate|retrieve)\s+(?:(?:the|my|a)\s+)?(?:(?:saved|stored|local)\s+){0,2}(?:notes?|files?|documents?|records?)\b/iu.test(text);
 const impliedRead=!!search&&!!answer&&!additionalAction.test(text)&&!/\b(?:compare|contrast|calculate|compute|sum|total|average|translate)\b|(?:比較|対比|計算|合計|平均|翻訳)/iu.test(text)&&!localizedMoreWork.test(text)
  &&(/\bmemory\b|(?:メモリー|メモリ)/iu.test(text)||explicitSavedFileSearch)
  &&/\b(?:tell\s+me|answer|report|identify)\b|教えて|答えて|報告して|特定して/iu.test(text)
  &&!/\b(?:explain|describe)\s+how\b.{0,30}\b(?:search|find|memory|tool)s?\s+(?:works?|function|operates?)\b/iu.test(text);
 return !!search&&!!answer&& (!!read||impliedRead||localizedSearch.test(text)&&localizedMemory.test(text)&&localizedAnswer.test(text));
}

/** True only when the user requested a result but omitted the internal read step. */
export function requestsImplicitSearchReadAnswer(text:string){
 const hasRead=/\b(?:read|open|inspect)\s+(?:(?:the|this|that|my|matching|relevant|exact|full|complete|saved|local)\s+){0,4}(?:file|notes?|documents?|records?|source|result|contents?)\b|\b(?:read|open|inspect)\s+(?:it|them)\b|(?:読んで|読み込んで|読み取って|開いて|目を通して|内容を確認して)/iu.test(text)||localizedRead.test(text);
 const moreWork=additionalAction.test(text)||/\b(?:compare|contrast|calculate|compute|sum|total|average|translate)\b|(?:比較|対比|計算|合計|平均|翻訳)/iu.test(text)||localizedMoreWork.test(text);
 return !hasRead&&!moreWork&&requestsLocalSearchReadAnswer(text);
}

/** A literal search shortcut must not swallow an explicit next operation.
 * Keep search → compare/calculate/cite/save (and similar work) with the agent loop
 * so the result is fed back to the model instead of ending at “Found”. */
export function requestsCompoundSearchTask(text:string){
 const value=text.trim();
 const fileNames=[...value.matchAll(/[\p{L}\p{N}_-]+\.(?:md|markdown|txt|pdf|docx?|rtf)\b/giu)];
 const namedMultipleFiles=new Set(fileNames.map(match=>match[0].normalize('NFKC').toLocaleLowerCase())).size>=2;
 const compoundOperation=/\b(?:read|open|inspect|compare|contrast|reconcile|cross[ -]?reference|calculate|compute|sum|total|cite|source|summari[sz]e|answer|tell|show|report|explain|identify|extract|translate|verify|confirm|list|save|store|create|write|edit|update|change|rewrite|delete|remove|schedule|notify|send|export)\b|(?:読み|読ん|開い|比較|対比|照合|計算|合計|引用|出典|要約|まとめ|回答|教え|見せ|説明|特定|抽出|翻訳|検証|確認|一覧)/iu.test(value);
 // Explicit multi-file requests need not begin with an English search verb:
 // Japanese prompts commonly start with the filenames or a modifier such as
 // “saved”. Exact names plus a requested read/synthesis are sufficient here.
 if(namedMultipleFiles&&compoundOperation)return true;
 if(!/^(?:please\s+)?(?:search(?:\s+for)?|find|look\s+(?:for|up)|locate|retrieve)\b/iu.test(value))return false;
 return /(?:[,.!?;:]\s*|\b(?:and|then|after(?:\s+that)?|also|before)\s+)(?:please\s+)?(?:then\s+)?(?:read|open|inspect|compare|contrast|reconcile|cross[ -]?reference|calculate|compute|sum|total|cite|source|summari[sz]e|answer|tell|show|report|explain|identify|extract|translate|verify|confirm|list|save|store|create|write|edit|update|change|rewrite|delete|remove|schedule|notify|send|export)\b/iu.test(value);
}

/** A completed exact read can go straight to grounded answer generation only
 * when the request does not ask for another lookup, comparison, or calculation. */
export function requestsMoreToolWorkAfterRead(text:string){
 if(additionalAction.test(text))return true;
 const reads=[...text.matchAll(/\b(?:read|open|inspect)\b|(?:読み込んで|読んで|読み取って|開いて|目を通して)/giu)];
 const last=reads.at(-1);if(!last||last.index===undefined)return false;
 const tail=text.slice(last.index+last[0].length);
 return /\b(?:search(?:\s+for)?|find|look\s+(?:for|up)|locate|retrieve|read|open|inspect|compare|contrast|reconcile|cross[ -]?reference|calculate|compute|sum|total|extract|translate|difference|match)\b|(?:検索|探し|読み込ん|読ん|読み取|開い|比較|対比|照合|計算|合計|抽出|翻訳|違い|差分|突き合わせ)/iu.test(tail);
}

export function requestsSynthesisWithoutMoreTools(question:string){
 if(additionalAction.test(question)||/\b(?:calculate|compute|sum|total|average|mean|percentage|percent|ratio)\b|(?:計算|合計|総計|平均|割合|比率)/iu.test(question))return false;
 const stages=[...question.matchAll(/\b(?:compare|contrast|summari[sz]e|explain|describe|answer|report|identify|list)\b|(?:比較|対比|要約|まとめ|説明|回答|報告|特定)/giu)];
 const last=stages.at(-1);if(!last||last.index===undefined)return false;
 const tail=question.slice(last.index+last[0].length);
 return !/\b(?:search|find|look\s+(?:for|up)|locate|retrieve|read|open|inspect|extract|translate|verify|confirm)\b|(?:検索|探し|読み|開い|抽出|翻訳|確認|検証)/iu.test(tail);
}
export function decisionMayRouteRequest(enabled:boolean,ready:boolean,text:string,plannerProtocol:'json'|'native-tool-calls'='json',resources:{textResident?:boolean;textFilesPresent?:boolean}={}){
 // A native-tool planner can make the route and tool choice in its own turn.
 // The app has one inference resident: do not evict a warm Text model just to
 // load Decision, and do not load Decision if Text cannot be prepared anyway.
 return enabled&&ready&&plannerProtocol!=='native-tool-calls'&&!resources.textResident&&resources.textFilesPresent!==false&&!requestsCrossSource(text)&&!requestsLocalSearchReadAnswer(text);
}

export function namesExplicitSavedKnowledge(text:string){
 return explicitSavedFilename.test(text)||explicitMemoryPath.test(text)||/\b(?:saved|stored)\s+(?:(?:[\p{L}\p{N}-]+)\s+){0,8}(?:notes?|files?|documents?|records?)\b/iu.test(text)
  ||/\b(?:search|find|look\s+(?:for|up)|retrieve|read|open)\s+(?:in\s+)?memory\b/iu.test(text)
  ||/\b(?:in|from)\s+memory\b/iu.test(text)
  ||/(?:保存した|保存済み).{0,40}(?:メモ|ノート|ファイル|文書|記録)/u.test(text);
}

export function namedJapaneseSavedSubject(text:string){
 return /(?:保存した|保存済みの|自分の|私の)\s*([\p{L}\p{N}\p{M} _.-]{2,80}?)の(?:メモ|ノート|ファイル|文書|記録)/u.exec(text)?.[1].trim()||null;
}

export function namedEnglishSavedSubject(text:string){
 const subject=/\b(?:(?:my\s+)?(?:saved|stored)|my)\s+((?:(?:[\p{L}\p{N}-]+)\s+){1,8})(?:notes?|files?|documents?|records?)\b/iu.exec(text)?.[1].trim();
 // The shorter `my <subject>` alternative can otherwise backtrack over
 // “my saved note” and mistake “saved” for the subject. Keep generic saved
 // knowledge queries intact so retrieval can use the full question.
 return subject&&!/^(?:saved|stored|current|previous|last|latest|first|this|that)\b/i.test(subject)?subject:null;
}

// English source names must not match the beginning of another word (dock /
// docker). Separators are folded for filenames; originals are never changed.
export function matchesNamedSource(value:string,subject:string,english:boolean){
 const fold=(s:string)=>{const normalized=s.normalize('NFKC').toLocaleLowerCase();return english?normalized.replace(/[-_\s]+/g,' '):normalized;};
 const haystack=fold(value),needle=fold(subject);if(!needle)return false;
 let position=haystack.indexOf(needle);
 while(position!==-1){
  if(!english)return true;
  const before=Array.from(haystack.slice(0,position)).at(-1),after=Array.from(haystack.slice(position+needle.length))[0],word=(s:string|undefined)=>!!s&&/[\p{L}\p{N}\p{M}]/u.test(s);
  if(!word(before)&&!word(after))return true;
  position=haystack.indexOf(needle,position+1);
 }
 return false;
}

/** Resolve only distinct search-result filenames that the user named verbatim.
 * Duplicate basenames remain ambiguous; ordinary topic words are not enough. */
export function explicitlyNamedSearchResultIds(question:string,results:readonly unknown[]){
 if(!Array.isArray(results))return [] as string[];
 const candidates=new Map<string,{ids:Set<string>;order:number}>();
 for(let order=0;order<results.length;order++){
  const row=results[order];if(!row||typeof row!=='object'||Array.isArray(row))continue;
  const value=row as Record<string,unknown>,id=typeof value.noteId==='string'?value.noteId:'';
  if(!id)continue;
  const paths=[value.path,value.title].filter((item):item is string=>typeof item==='string');
  for(const path of paths){
   const filename=path.split(/[\\/]/).at(-1)?.trim()??'',extension=/\.(?:md|markdown|txt|pdf|docx?|rtf)$/i.exec(filename)?.[0]??'';
   const basename=extension?filename.slice(0,-extension.length).trim():filename;
   if(!basename)continue;
   const explicitlyFullName=!!extension&&matchesNamedSource(question,basename+extension,true);
   if(basename.split(/\s+/).length<2&&!explicitlyFullName)continue;
   if(!matchesNamedSource(question,basename,true))continue;
   const key=basename.normalize('NFKC').toLocaleLowerCase().replace(/[-_\s]+/g,' ');
   const group=candidates.get(key)??{ids:new Set<string>(),order};group.ids.add(id);candidates.set(key,group);
  }
 }
 if(candidates.size<2||[...candidates.values()].some(group=>group.ids.size!==1))return [];
 return [...new Map([...candidates.values()].sort((a,b)=>a.order-b.order).flatMap(group=>[...group.ids].map(id=>[id,id] as const))).keys()];
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
