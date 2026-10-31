/** Reject an obvious type mismatch without claiming to verify semantic entailment. */
export function checkAnswerConsistency(question:string,answer:string,sourceEvidence:readonly {quote?:string}[]=[]){
 const q=question.normalize('NFKC'),a=answer.normalize('NFKC').trim();
 // This is a narrow contradiction guard, not general semantic entailment. A
 // live model run compared two locations even though neither excerpt contained
 // a distance or a proximity relation. Permit the claim only when the source
 // states that comparison, or contains two comparable measured distances.
 const evidence=(sourceEvidence??[]).flatMap(item=>typeof item?.quote==='string'?[item.quote.normalize('NFKC')]:[]);
 const distanceUnits=(text:string)=>[...text.matchAll(/([0-9]+(?:[.,][0-9]+)?)\s*(km|kilomet(?:er|re)s?|mi|miles?|meters?|metres?|m|キロメートル|キロ|メートル)(?![A-Za-z])/giu)].map(match=>{
  const unit=match[2].toLocaleLowerCase();return /^(?:km|kilomet|キロ)/u.test(unit)?'km':/^(?:mi|mile)/u.test(unit)?'mi':'m';
 });
 const comparableDistanceEvidence=['km','m','mi'].some(unit=>evidence.reduce((count,text)=>count+distanceUnits(text).filter(value=>value===unit).length,0)>=2);
 const normalizeClaim=(value:string)=>value.normalize('NFKC').replace(/[\s。.!！?？,，、:：]/gu,'').toLocaleLowerCase();
 const comparativeLocationSentences=a.split(/[。.!！?？\n]+/u).map(value=>value.trim()).filter(Boolean).filter(value=>/(?:の方が|のほうが|より)\s*(?:ずっと|もっと)?近(?:い|く|かった|いです|かったです)|\b(?:closer|nearer|nearest)\b/iu.test(value));
 for(const sentence of comparativeLocationSentences){
  const uncertainty=/(?:どちら|どっち|どの場所|どの地点).{0,24}近.{0,60}(?:分から|わから|判断でき|特定でき|記載.{0,6}(?:ない|ありません)|書かれて.{0,6}(?:ない|いません)|不明|cannot determine|can't determine|unable to determine|not stated|no distance)/iu.test(sentence);
  if(uncertainty)continue;
  const claims=sentence.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{N}A-Za-z・ー]{1,28}(?:の方が|のほうが|より)(?:ずっと|もっと)?近(?:い|く|かった|いです|かったです)?/gu)??[];
  const englishClaims=sentence.match(/\b[\p{L}\p{N}][\p{L}\p{N}'’ -]{0,32}\b(?:closer|nearer|nearest)\b(?:\s+than\s+[\p{L}\p{N}][\p{L}\p{N}'’ -]{0,32})?/giu)??[];
  const supported=evidence.some(source=>[...claims,...englishClaims].some(claim=>normalizeClaim(source).includes(normalizeClaim(claim))));
  if(!supported&&!comparableDistanceEvidence)throw Error('Answer contains unsupported location comparison · try again');
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
 // English quote requests, require at least one non-generic topic word from
 // the question to occur in the quoted answer as well.
 if(/\b(?:quote|copy|extract)\b/iu.test(q)&&/\b(?:file|document|pdf|text|attachment|image|audio|video)\b/iu.test(q)){
  const ignored=new Set(['quote','copy','extract','sentence','passage','paragraph','this','that','these','those','the','from','using','only','attached','current','file','document','pdf','text','attachment','image','audio','video','that','states','state','gives','give','contains','contain','about','with','which','what','where','when','who','why','how','is','are','was','were','in','on','of','and','for','to']);
  const terms=(value:string)=>new Set((value.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu)??[]).filter(word=>word.length>2&&!ignored.has(word)));
  const topics=terms(q),quoted=terms(a);
  if(topics.size&&![...topics].some(word=>quoted.has(word)))throw Error('Quoted answer does not match question · try again');
  const normalize=(value:string)=>value.normalize('NFKC').replace(/[“”„]/gu,'"').replace(/[‘’]/gu,"'").replace(/\s+/gu,' ').trim().toLocaleLowerCase();
  const response=normalize(answer),relevant=(sourceEvidence??[]).flatMap(item=>typeof item?.quote==='string'?item.quote.split(/\r?\n+/u).flatMap(line=>line.match(/[^.!?。！？]+[.!?。！？]?/gu)??[]):[]).map(sentence=>sentence.trim()).filter(sentence=>sentence&&[...terms(sentence)].some(word=>topics.has(word)));
  // A quote request must reproduce a complete matching sentence that is
  // present in the scoped evidence. Echoing the request with an unrelated
  // citation is provenance-valid text, but not an answer to the request.
  if(relevant.length&&!relevant.some(sentence=>response.includes(normalize(sentence))))throw Error('Quoted answer does not match source · try again');
 }
}
