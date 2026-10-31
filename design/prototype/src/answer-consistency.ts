/** Reject an obvious type mismatch without claiming to verify semantic entailment. */
export function checkAnswerConsistency(question:string,answer:string,sourceEvidence:readonly {quote?:string}[]=[]){
 const q=question.normalize('NFKC'),a=answer.normalize('NFKC').trim();
 // This is a narrow contradiction guard, not general semantic entailment. A
 // live model run compared two locations even though neither excerpt contained
 // a distance or a proximity relation. Permit the claim only when the source
 // states that comparison, or contains two comparable measured distances.
 const evidence=(sourceEvidence??[]).flatMap(item=>typeof item?.quote==='string'?[item.quote.normalize('NFKC')]:[]);
 const placeKey=(value:string)=>value.normalize('NFKC').replace(/^[\s,，、:：]+|[\s,，、:：]+$/gu,'').replace(/\s+/gu,' ').replace(/^(?:the|a|an)\s+/iu,'').toLocaleLowerCase();
 const distancePattern='([0-9]+(?:[.,][0-9]+)?)\\s*(km|kilomet(?:er|re)s?|mi|miles?|meters?|metres?|m|キロメートル|キロ|メートル)(?![A-Za-z])';
 const distanceInMeters=(amount:string,unit:string)=>{
  const value=Number(amount.replace(',','.')),normalized=unit.toLocaleLowerCase();
  if(!Number.isFinite(value)||value<=0)return null;
  if(/^(?:km|kilomet|キロ)/u.test(normalized))return value*1000;
  if(/^(?:mi|mile)/u.test(normalized))return value*1609.344;
  return value;
 };
 const measuredPlaces=(text:string)=>{
  const found:{name:string;meters:number}[]=[];
  const add=(name:string,amount:string,unit:string)=>{
   const meters=distanceInMeters(amount,unit),normalized=placeKey(name);
   if(meters!==null&&normalized.length>1)found.push({name:normalized,meters});
  };
  // Only bind distances that are explicitly attached to a named place. A
  // pair of numbers somewhere in the citations is not comparison evidence.
  for(const clause of text.split(/[,;，；、。\n]|\band\b/giu)){
   const japanese=new RegExp(`([\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}\\p{N}A-Za-z・ー]{2,40}?)(?:まで|は|が|から)\\s*(?:約|およそ)?${distancePattern}`,'giu');
   for(const match of clause.matchAll(japanese))add(match[1],match[2],match[3]);
   const english=new RegExp(`([\\p{L}\\p{N}][\\p{L}\\p{N}'’ -]{1,48}?)\\s+(?:is\\s+)?(?:about\\s+)?${distancePattern}`,'giu');
   for(const match of clause.matchAll(english))add(match[1].replace(/\\s+is$/iu,''),match[2],match[3]);
   const afterUnit=new RegExp(`${distancePattern}\\s+(?:from|to)\\s+([\\p{L}\\p{N}][\\p{L}\\p{N}'’ -]{1,48})`,'giu');
   for(const match of clause.matchAll(afterUnit))add(match[3],match[1],match[2]);
  }
  return found;
 };
 const comparisonPlaces=(sentence:string)=>{
  const places:string[]=[];
   for(const match of sentence.matchAll(/([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{N}A-Za-z・ー]{2,32}?)の方が([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{N}A-Za-z・ー]{2,32}?)より(?:(?:ずっと|もっと)\s*)?近/gu))places.push(match[1],match[2]);
   for(const match of sentence.matchAll(/([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{N}A-Za-z・ー]{2,32}?)より([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{N}A-Za-z・ー]{2,32}?)の方が(?:(?:ずっと|もっと)\s*)?近/gu))places.push(match[2],match[1]);
   if(places.length)return [...new Set(places.map(value=>value.normalize('NFKC').replace(/[\s。.!！?？,，、:：]/gu,'').toLocaleLowerCase()).filter(value=>value.length>1))];
  for(const match of sentence.matchAll(/([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{N}A-Za-z・ー]{2,32}?)(?:の方が|のほうが)(?:(?:ずっと|もっと)\s*)?近/gu))places.push(match[1]);
  for(const match of sentence.matchAll(/([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{N}A-Za-z・ー]{2,32}?)より(?:(?:ずっと|もっと)\s*)?近/gu))places.push(match[1]);
  for(const match of sentence.matchAll(/([\p{L}\p{N}][\p{L}\p{N}'’ -]{1,40}?)\s+(?:is\s+)?(?:closer|nearer|nearest)\s+than\s+([\p{L}\p{N}][\p{L}\p{N}'’ -]{1,40})/giu))places.push(match[1].replace(/\s+is$/iu,''),match[2]);
  for(const match of sentence.matchAll(/([\p{L}\p{N}][\p{L}\p{N}'’ -]{1,40}?)\s+(?:is\s+)?(?:closer|nearer|nearest)\b/giu))places.push(match[1].replace(/\s+is$/iu,''));
  return [...new Set(places.map(placeKey).filter(value=>value.length>1))];
 };
 const normalizeClaim=(value:string)=>value.normalize('NFKC').replace(/[\s。.!！?？,，、:：]/gu,'').toLocaleLowerCase();
 const comparativeLocationSentences=a.split(/[。.!！?？\n]+/u).map(value=>value.trim()).filter(Boolean).filter(value=>/(?:の方が|のほうが|より)\s*(?:ずっと|もっと)?近(?:い|く|かった|いです|かったです)|\b(?:closer|nearer|nearest)\b/iu.test(value));
 for(const sentence of comparativeLocationSentences){
  const claims=sentence.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{N}A-Za-z・ー]{1,28}(?:の方が|のほうが|より)(?:ずっと|もっと)?近(?:い|く|かった|いです|かったです)?/gu)??[];
  const englishClaims=sentence.match(/\b[\p{L}\p{N}][\p{L}\p{N}'’ -]{0,32}\b(?:closer|nearer|nearest)\b(?:\s+than\s+[\p{L}\p{N}][\p{L}\p{N}'’ -]{0,32})?/giu)??[];
  if(!claims.length&&!englishClaims.length)continue;
  const uncertainty=/(?:どちら|どっち|どの場所|どの地点).{0,24}近.{0,60}(?:分から|わから|判断でき|特定でき|記載.{0,6}(?:ない|ありません)|書かれて.{0,6}(?:ない|いません)|不明|cannot determine|can't determine|unable to determine|not stated|no distance)/iu.test(sentence);
  if(uncertainty)continue;
  const negated=/(?:\b(?:not|never)\s+(?:closer|nearer|nearest)\b|\b(?:isn't|aren't|wasn't|weren't)\s+(?:closer|nearer|nearest)\b|\bno\s+(?:closer|nearer)\s+than\b|近(?:く|い)(?:は|が)?(?:ありませんでした|ありません|なかったです|なかった|ないです|ない))/iu.test(sentence);
  const operandSentence=sentence.replace(/\b(?:is|are|was|were)\s+not\s+(?=(?:closer|nearer|nearest)\b)/giu,'').replace(/\b(?:isn't|aren't|wasn't|weren't)\s+(?=(?:closer|nearer|nearest)\b)/giu,'').replace(/\bno\s+(?=(?:closer|nearer)\s+than\b)/giu,'');
  const operands=comparisonPlaces(operandSentence);
   const assertedLeftIsCloser=!negated;
   const samePlace=(left:string,right:string)=>placeKey(left)===placeKey(right);
   const sourceRelation=(sourceSentence:string)=>{
    const sourceNegated=/(?:\b(?:not|never)\s+(?:closer|nearer|nearest)\b|\b(?:isn't|aren't|wasn't|weren't)\s+(?:closer|nearer|nearest)\b|\bno\s+(?:closer|nearer)\s+than\b|近(?:く|い)(?:は|が)?(?:ありませんでした|ありません|なかったです|なかった|ないです|ない))/iu.test(sourceSentence);
    const sourceOperandSentence=sourceSentence.replace(/\b(?:is|are|was|were)\s+not\s+(?=(?:closer|nearer|nearest)\b)/giu,'').replace(/\b(?:isn't|aren't|wasn't|weren't)\s+(?=(?:closer|nearer|nearest)\b)/giu,'').replace(/\bno\s+(?=(?:closer|nearer)\s+than\b)/giu,'');
    const sourceOperands=comparisonPlaces(sourceOperandSentence);
    if(sourceOperands.length!==operands.length||!operands.length)return null;
    if(operands.length===1)return samePlace(sourceOperands[0],operands[0])?!sourceNegated:null;
    if(samePlace(sourceOperands[0],operands[0])&&samePlace(sourceOperands[1],operands[1]))return !sourceNegated;
    if(samePlace(sourceOperands[0],operands[1])&&samePlace(sourceOperands[1],operands[0]))return sourceNegated;
    return null;
   };
   // Direct quoted comparison evidence must name the same parsed entities.
   // Substring matching a clipped claim ("Aoba Park is closer") incorrectly
   // accepted a different full entity ("New Aoba Park").
   const supported=evidence.some(source=>source.split(/[。.!！?？\n]+/u).map(value=>value.trim()).filter(Boolean).some(sourceSentence=>sourceRelation(sourceSentence)===assertedLeftIsCloser));
   const observedRelations:boolean[]=[];
   if(operands.length>1){
    for(const source of evidence){
     for(const sourceSentence of source.split(/[。.!！?？\n]+/u).map(value=>value.trim()).filter(Boolean)){
      const relation=sourceRelation(sourceSentence);
      if(relation!==null)observedRelations.push(relation);
     }
    }
   }
   let supportedByMeasuredDistances=false;
   for(const source of evidence){
   const measurements=measuredPlaces(source),byPlace=new Map<string,number[]>();
   for(const measurement of measurements){const values=byPlace.get(measurement.name)??[];values.push(measurement.meters);byPlace.set(measurement.name,values);}
   const matching=(name:string)=>[...byPlace].find(([candidate])=>placeKey(candidate)===placeKey(name));
    const left=matching(operands[0]);if(!left||left[1].length!==1)continue;
   if(operands.length>1){
     const right=matching(operands[1]);
     if(!right||right[0]===left[0]||right[1].length!==1)continue;
     const leftIsCloser=left[1][0]<right[1][0];observedRelations.push(leftIsCloser);if(leftIsCloser===assertedLeftIsCloser)supportedByMeasuredDistances=true;
     continue;
   }
    if(negated)continue;
    if([...byPlace].filter(([name,values])=>name!==left[0]&&values.length===1).length>0&&[...byPlace].filter(([name,values])=>name!==left[0]&&values.length===1).every(([,values])=>left[1][0]<values[0]))supportedByMeasuredDistances=true;
   }
   if(observedRelations.some(relation=>relation!==assertedLeftIsCloser))throw Error('Answer contains conflicting location evidence · try again');
  if(!supported&&!supportedByMeasuredDistances)throw Error('Answer contains unsupported location comparison · try again');
 }
 const colorQuestion=/(?:何色|どんな色|何の色|what colou?r|which colou?r)/iu.test(q);
 const onlyQuantity=/^(?:(?:約|およそ)\s*)?(?:[0-9０-９.,]+|[零〇一二三四五六七八九十百千万]+)\s*(?:リットル|リッター|ミリリットル|キログラム|グラム|メートル|lit(?:er|re)s?|millilit(?:er|re)s?|kilograms?|grams?|meters?|metres?|l|ml|kg|g|m)(?:\s*です)?[。.!！\s]*$/iu.test(a);
 if(colorQuestion&&onlyQuantity)throw Error('Answer does not match question · try again');
 // A meeting-time request cannot be satisfied by returning only an unrelated
 // location or supply quantity. This check does not establish entailment.
 const meetingTime=/(?:集合時刻|集合時間|何時に集合|集合は何時)/u.test(q);
 const timeOrUncertainty=/(?:\d{1,2}\s*[:：]\s*\d{2}|[0-9一二三四五六七八九十]+\s*時|午前|午後|正午|真夜中|朝|昼|夕方|夜|日の出|日没|不明|未定|記載.{0,5}(?:ない|ありません)|書かれて.{0,5}(?:ない|いません)|見つからない)/u.test(a);
 // Recognizing a few Japanese time phrases is not a language-independent
 // completeness check. Reject only an explicitly recognized non-time answer;
 // an English/multilingual statement of missing evidence is not a mismatch.
 const statements=a.split(/[。.!！\n]+/u).map(text=>text.trim()).filter(Boolean);
 const onlyOtherFacts=statements.length>0&&statements.every(text=>/^(?:集合場所|飲料水|水の量|備蓄量)\s*(?:は|:|：)/u.test(text));
 if(meetingTime&&!timeOrUncertainty&&(onlyQuantity||onlyOtherFacts))throw Error('Answer does not match question · try again');
 // Exact substring validation proves provenance, not relevance. For explicit
 // quote requests in English or Japanese, bind the answer to a relevant source
 // sentence; Japanese topic hints use small character n-grams after removing
 // common request words because this browser build has no Japanese segmenter.
 const englishQuoteRequest=/\b(?:quote|copy|extract)\b/iu.test(q)&&/\b(?:file|document|pdf|text|attachment|image|audio|video)\b/iu.test(q);
 const japaneseQuoteRequest=/(?:原文|一文|文章|箇所|部分|引用文).{0,20}(?:引用|そのまま|抜き出|書き写)|(?:引用|抜き出|書き写).{0,20}(?:原文|一文|文章|箇所|部分|引用文)|(?:引用|抜き出|書き写).{0,12}(?:して|ください|ほしい|くれ|もらえ)|そのまま.{0,12}(?:引用|抜き出|書き写)/u.test(q);
 if(englishQuoteRequest||japaneseQuoteRequest){
  const ignored=new Set(['quote','copy','extract','sentence','passage','paragraph','this','that','these','those','the','from','using','only','attached','current','file','document','pdf','text','attachment','image','audio','video','that','states','state','gives','give','contains','contain','about','with','which','what','where','when','who','why','how','is','are','was','were','in','on','of','and','for','to']);
  const terms=(value:string)=>new Set((value.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu)??[]).filter(word=>word.length>2&&!ignored.has(word)));
  const topics=terms(q),quoted=terms(a);
  const requestWords=/(?:この|その|あの|どの|ファイル|文書|テキスト|メモ|内容|書いてある|書かれている|書かれた|記載された|中から|について|に関する|原文|一文|文章|箇所|部分|引用文|引用|そのまま|抜き出して|抜き出す|書き写して|書き写す|してください|してほしい|教えて|ですか|でしたか|です|ます|する|して|されて|として|ある|いる|こと|もの|これ|あれ|どれ|から|まで|より|の|は|が|を|に|で|と|へ|も|や|など)/gu;
  const japaneseNgrams=(value:string)=>{
   const cleaned=value.normalize('NFKC').toLocaleLowerCase().replace(requestWords,' ');
   const grams=new Set<string>();
   for(const run of cleaned.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{N}]{2,}/gu)??[]){const chars=Array.from(run);for(let index=0;index+1<chars.length;index++)grams.add(chars.slice(index,index+2).join(''));}
   return grams;
  };
  const japaneseTopicGrams=japaneseNgrams(q);
  const hasTopic=(value:string)=>[...terms(value)].some(word=>topics.has(word))||[...japaneseNgrams(value)].some(gram=>japaneseTopicGrams.has(gram));
  if((topics.size||japaneseTopicGrams.size)&&!hasTopic(answer))throw Error('Quoted answer does not match question · try again');
  const normalize=(value:string)=>value.normalize('NFKC').replace(/[“”„]/gu,'"').replace(/[‘’]/gu,"'").replace(/\s+/gu,' ').trim().toLocaleLowerCase();
  const response=normalize(answer),relevant=(sourceEvidence??[]).flatMap(item=>typeof item?.quote==='string'?item.quote.split(/\r?\n+/u).flatMap(line=>line.match(/[^.!?。！？]+[.!?。！？]?/gu)??[]):[]).map(sentence=>sentence.trim()).filter(sentence=>sentence&&hasTopic(sentence));
  // A quote request must reproduce a complete matching sentence that is
  // present in the scoped evidence. Echoing the request with an unrelated
  // citation is provenance-valid text, but not an answer to the request.
  if(!relevant.length||!relevant.some(sentence=>response.includes(normalize(sentence))))throw Error('Quoted answer does not match source · try again');
 }
}
