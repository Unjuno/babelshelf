/** Reject an obvious type mismatch without claiming to verify semantic entailment. */
export function checkAnswerConsistency(question:string,answer:string,sourceEvidence:readonly {quote?:string}[]=[]){
 const q=question.normalize('NFKC'),a=answer.normalize('NFKC').trim();
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
