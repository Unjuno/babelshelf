import {calculate} from './tools/math.calculate/tool.ts';

// Deliberately narrow: a single original time in one current excerpt and an
// explicit same-day "minutes before HH:MM" question. Other time questions
// remain with the normal evidence answer path rather than guessed parsing.
export function exactMinutesBefore(question:string,excerpt:string):string|null{
 const target=/\bhow\s+many\s+minutes\s+before\s+((?:[01]?\d|2[0-3]):[0-5]\d)\b/i.exec(question);
 if(!target)return null;
 const subject=/\bis\s+(?:the|my|a)\s+([\p{L}][\p{L}\p{N}-]*)\b/iu.exec(question);
 if(!subject)return null;
 const times=[...excerpt.matchAll(/\b((?:[01]?\d|2[0-3]):[0-5]\d)\b/g)];
 if(times.length!==1)return null;
 const named=subject[1].replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const linked=new RegExp(`\\b${named}\\b[^\\n]{0,80}\\b(?:is|starts)\\b[^\\n]{0,80}\\bat\\s+${times[0][1]}\\b`,'iu');
 if(!linked.test(excerpt))return null;
 const minutes=(time:string)=>{const [hour,minute]=time.split(':').map(Number);return hour*60+minute;};
 const delta=calculate(`${minutes(target[1])}-${minutes(times[0][1])}`);
 if(!Number.isInteger(delta)||delta<=0)return null;
 return `${delta} ${delta===1?'minute':'minutes'} before ${target[1]}.`;
}
