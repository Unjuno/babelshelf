export const REPLY_STYLES=['balanced','concise','detailed'] as const;
export type ReplyStyle=typeof REPLY_STYLES[number];

/** One language contract for both agent completion and separate answer generation.
 * Tool guides, application labels and source languages do not choose the reply language. */
export const answerLanguageInstruction='Write in the explicitly requested output language(s), otherwise in the language of the latest user request. English interface labels and tool guides do not change that language. Preserve original quotations and proper names exactly; do not add unrequested translations or guessed romanizations.';

const guidance:Record<ReplyStyle,string>={
 balanced:'Use a clear, proportionate answer.',
 concise:'Prefer a brief answer while preserving necessary context.',
 detailed:'Give more explanation and useful context when the request allows it.',
};
const explicitLongRequest=/(?:\bin detail\b|\bdetailed\b|\bcomprehensive\b|\bthorough\b|\bstep[- ]by[- ]step\b|\blong[- ]form\b|\bwrite (?:me )?a story\b|\b(?:\d+|two|three|four|five|several) paragraphs?\b|詳しく|詳細に|詳細な|網羅的|徹底的|段階的に|長文|物語|\d+段落)/u;
const additionalStage=/(?:\bthen\b|\bafterwards\b|\bfollowed by\b|その後|そのあと|続けて|その上で)/iu;

/** Fixed presentation guidance only; no free-form setting can alter harness policy. */
export function replyStyleInstruction(value:unknown='balanced'){
 if(typeof value!=='string'||!REPLY_STYLES.includes(value as ReplyStyle))throw Error('Unsupported reply style');
 return 'Default response style: '+guidance[value as ReplyStyle]+' The user\'s explicit request for language, length or format takes precedence. This preference does not change evidence, citations, permissions, tools or task scope.';
}

/** Bounded dialogue generation allowance; explicit length requests outrank preferences. */
export function dialogueOutputLimits(style:unknown,question:string,availableTokens:number){
 if(typeof style!=='string'||!REPLY_STYLES.includes(style as ReplyStyle))throw Error('Unsupported reply style');
 if(typeof question!=='string'||!Number.isSafeInteger(availableTokens)||availableTokens<1)throw Error('Invalid dialogue output budget');
 const text=question.toLocaleLowerCase();
 const explicitShort=/(?:\bbriefly\b|\bshort answer\b|\bone sentence\b|\b(?:exactly\s+)?two sentences?\b|\b(?:one|two)[- ]sentence\b|\bconcise(?:ly)?\b|\btldr\b|簡潔に|短く|一言で|一文で|二文で|2文で|要点だけ)/u.test(text);
 const explicitLong=explicitLongRequest.test(text);
 let total:number,segment:number;
 if(explicitLong&&explicitShort&&additionalStage.test(text)){total=3072;segment=768;}
 else if(explicitShort){total=256;segment=256;}
 else if(explicitLong){total=3072;segment=768;}
 else if(style==='concise'){total=256;segment=256;}
 else if(style==='detailed'){total=1536;segment=768;}
 else {total=768;segment=512;}
 total=Math.min(total,availableTokens);
 return {total,segment:Math.min(segment,total)};
}

/** Evidence-backed answers use the same user-facing length policy, bounded by remaining model context. */
export function groundedOutputTokens(style:unknown,question:string,availableTokens:number){
 return dialogueOutputLimits(style,question,availableTokens).total;
}

export function requestsOneSentence(question:string){
 return typeof question==='string'&&!(explicitLongRequest.test(question.toLocaleLowerCase())&&additionalStage.test(question))&&/(?:\b(?:exactly\s+)?one[\s-]+sentence\b|\bsingle\s+sentence\b|(?:一文|1文)(?:で|の|に))/iu.test(question);
}

/** Keep the user's explicit one-sentence format without another model pass. */
export function firstSentenceOnly(text:string){
 if(typeof text!=='string')throw Error('Invalid answer text');
 const segments=Array.from(new Intl.Segmenter(undefined,{granularity:'sentence'}).segment(text),part=>part.segment);
 if(!segments.length)return text.trim();
 let first=segments[0];
 // Some ICU builds split at common title/Latin abbreviations despite the
 // sentence granularity. Join the following segment when the first contains
 // only a standard abbreviation or a person initial.
 if(segments[1]&&/^(?:(?:Dr|Mr|Mrs|Ms|Prof|Sr|Jr|St|vs|etc|No|Fig|e\.g|i\.e)\.|[A-Z]\.)\s*$/iu.test(first.trim()))first+=segments[1];
 return first.trim();
}
