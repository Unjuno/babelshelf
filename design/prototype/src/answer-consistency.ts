/** Reject an obvious type mismatch without claiming to verify semantic entailment. */
export function checkAnswerConsistency(question:string,answer:string,sourceEvidence:readonly {quote?:string}[]=[]){
 const q=question.normalize('NFKC'),a=answer.normalize('NFKC').trim();
 // This is a narrow contradiction guard, not general semantic entailment. A
 // live model run compared two locations even though neither excerpt contained
 // a distance or a proximity relation. Permit the claim only when the source
 // states that comparison, or contains two comparable measured distances.
 const evidence=(sourceEvidence??[]).flatMap(item=>typeof item?.quote==='string'?[item.quote.normalize('NFKC')]:[]);
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
   const meters=distanceInMeters(amount,unit),normalized=name.normalize('NFKC').replace(/^[\s,，、:：]+|[\s,，、:：]+$/gu,'').replace(/\s+/gu,' ').toLocaleLowerCase();
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
  for(const match of sentence.matchAll(/([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{N}A-Za-z・ー]{2,32}?)(?:の方が|のほうが)(?:(?:ずっと|もっと)\s*)?近/gu))places.push(match[1]);
  for(const match of sentence.matchAll(/([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{N}A-Za-z・ー]{2,32}?)より(?:(?:ずっと|もっと)\s*)?近/gu))places.push(match[1]);
  for(const match of sentence.matchAll(/([\p{L}\p{N}][\p{L}\p{N}'’ -]{1,40}?)\s+(?:is\s+)?(?:closer|nearer|nearest)\s+than\s+([\p{L}\p{N}][\p{L}\p{N}'’ -]{1,40})/giu))places.push(match[1].replace(/\s+is$/iu,''),match[2]);
  for(const match of sentence.matchAll(/([\p{L}\p{N}][\p{L}\p{N}'’ -]{1,40}?)\s+(?:is\s+)?(?:closer|nearer|nearest)\b/giu))places.push(match[1].replace(/\s+is$/iu,''));
  return [...new Set(places.map(value=>value.normalize('NFKC').replace(/[\s。.!！?？,，、:：]/gu,'').toLocaleLowerCase()).filter(value=>value.length>1))];
 };
 const normalizeClaim=(value:string)=>value.normalize('NFKC').replace(/[\s。.!！?？,，、:：]/gu,'').toLocaleLowerCase();
 const comparativeLocationSentences=a.split(/[。.!！?？\n]+/u).map(value=>value.trim()).filter(Boolean).filter(value=>/(?:の方が|のほうが|より)\s*(?:ずっと|もっと)?近(?:い|く|かった|いです|かったです)|\b(?:closer|nearer|nearest)\b/iu.test(value));
 for(const sentence of comparativeLocationSentences){
  const claims=sentence.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{N}A-Za-z・ー]{1,28}(?:の方が|のほうが|より)(?:ずっと|もっと)?近(?:い|く|かった|いです|かったです)?/gu)??[];
  const englishClaims=sentence.match(/\b[\p{L}\p{N}][\p{L}\p{N}'’ -]{0,32}\b(?:closer|nearer|nearest)\b(?:\s+than\s+[\p{L}\p{N}][\p{L}\p{N}'’ -]{0,32})?/giu)??[];
  if(!claims.length&&!englishClaims.length)continue;
  const uncertainty=/(?:どちら|どっち|どの場所|どの地点).{0,24}近.{0,60}(?:分から|わから|判断でき|特定でき|記載.{0,6}(?:ない|ありません)|書かれて.{0,6}(?:ない|いません)|不明|cannot determine|can't determine|unable to determine|not stated|no distance)/iu.test(sentence);
  if(uncertainty)continue;
  const supported=evidence.some(source=>[...claims,...englishClaims].some(claim=>normalizeClaim(source).includes(normalizeClaim(claim))));
  const operands=comparisonPlaces(sentence);
  const supportedByMeasuredDistances=operands.length>0&&evidence.some(source=>{
   const measurements=measuredPlaces(source),byPlace=new Map<string,number[]>();
   for(const measurement of measurements){const values=byPlace.get(measurement.name)??[];values.push(measurement.meters);byPlace.set(measurement.name,values);}
   const placeKey=(value:string)=>value.normalize('NFKC').replace(/[\s。.!！?？,，、:：]/gu,'').toLocaleLowerCase();
   const matching=(name:string)=>[...byPlace].find(([candidate])=>placeKey(candidate).includes(placeKey(name))||placeKey(name).includes(placeKey(candidate)));
   const left=matching(operands[0]);if(!left||left[1].length!==1)return false;
   if(operands.length>1){
    const right=matching(operands[1]);return !!right&&right[0]!==left[0]&&right[1].length===1&&left[1][0]<right[1][0];
   }
   return [...byPlace].filter(([name,values])=>name!==left[0]&&values.length===1).length>0&&[...byPlace].filter(([name,values])=>name!==left[0]&&values.length===1).every(([,values])=>left[1][0]<values[0]);
  });
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
