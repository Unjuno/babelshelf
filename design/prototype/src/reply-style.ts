export const REPLY_STYLES=['balanced','concise','detailed'] as const;
export type ReplyStyle=typeof REPLY_STYLES[number];

const guidance:Record<ReplyStyle,string>={
 balanced:'Use a clear, proportionate answer.',
 concise:'Prefer a brief answer while preserving necessary context.',
 detailed:'Give more explanation and useful context when the request allows it.',
};

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
 const explicitShort=/(?:\bbriefly\b|\bshort answer\b|\bone sentence\b|\bconcise(?:ly)?\b|\btldr\b|簡潔に|短く|一言で|一文で|要点だけ)/u.test(text);
 const explicitLong=/(?:\bin detail\b|\bdetailed\b|\bcomprehensive\b|\bthorough\b|\bstep[- ]by[- ]step\b|\blong[- ]form\b|\bwrite (?:me )?a story\b|\b(?:\d+|two|three|four|five|several) paragraphs?\b|詳しく|詳細に|詳細な|網羅的|徹底的|段階的に|長文|物語|\d+段落)/u.test(text);
 let total:number,segment:number;
 if(explicitShort){total=256;segment=256;}
 else if(explicitLong){total=3072;segment=768;}
 else if(style==='concise'){total=256;segment=256;}
 else if(style==='detailed'){total=1536;segment=768;}
 else {total=768;segment=512;}
 total=Math.min(total,availableTokens);
 return {total,segment:Math.min(segment,total)};
}
