export type ScheduleRule={repeat:string;time:string;days:number[];date:string;monthDay:number;interval:number;unit:string};
export const repeatOptions=[{value:'once',label:'Once'},{value:'daily',label:'Every day'},{value:'weekly',label:'Every week'},{value:'monthly',label:'Every month'},{value:'custom',label:'Custom'}];
export function localDate(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
function parseDate(value:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error('Use YYYY-MM-DD');
 const [y,m,d]=value.split('-').map(Number),date=new Date(y,m-1,d);
 if(localDate(date)!==value)throw Error('Invalid date');return date;
}
export function nextScheduleOccurrence(rule:ScheduleRule,now=new Date()):Date{
 if(!repeatOptions.some(x=>x.value===rule.repeat)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(rule.time))throw Error('Use HH:MM');
 const [h,m]=rule.time.split(':').map(Number),at=(date:Date)=>{date.setHours(h,m,0,0);return date;};
 if(rule.repeat==='once'){const next=at(parseDate(rule.date));if(next<=now)throw Error('Choose a future date and time');return next;}
 if(rule.repeat==='monthly'){
  if(!Number.isInteger(rule.monthDay)||rule.monthDay<1||rule.monthDay>31)throw Error('Day must be 1–31');
  for(let i=0;i<24;i++){const next=at(new Date(now.getFullYear(),now.getMonth()+i,rule.monthDay));if(next.getDate()===rule.monthDay&&next>now)return next;}
  throw Error('No next date');
 }
 if(rule.repeat==='custom'){
  if(!Number.isInteger(rule.interval)||rule.interval<1||rule.interval>365||!['days','weeks'].includes(rule.unit))throw Error('Use an interval from 1 to 365');
  const anchor=parseDate(rule.date),step=rule.interval*(rule.unit==='weeks'?7:1);
  const midnight=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const calendarDays=Math.round((Date.UTC(midnight.getFullYear(),midnight.getMonth(),midnight.getDate())-Date.UTC(anchor.getFullYear(),anchor.getMonth(),anchor.getDate()))/86400000);
  const occurrence=(days:number)=>at(new Date(anchor.getFullYear(),anchor.getMonth(),anchor.getDate()+days));
  const days=Math.max(0,Math.floor(calendarDays/step))*step,next=occurrence(days);
  // Reapply the requested wall time for each date. A normalized DST-gap time
  // must not become the clock time of all later occurrences.
  return next<=now?occurrence(days+step):next;
 }
 if(rule.repeat==='weekly'&&(!rule.days.length||rule.days.some(d=>!Number.isInteger(d)||d<0||d>6)))throw Error('Choose at least one weekday');
 for(let i=0;i<=7;i++){const next=at(new Date(now.getFullYear(),now.getMonth(),now.getDate()+i));if(next>now&&(rule.repeat==='daily'||rule.days.includes(next.getDay())))return next;}
 throw Error('No next date');
}
export function scheduleSummary(rule:ScheduleRule){
 const days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
 const when=rule.repeat==='once'?rule.date:rule.repeat==='weekly'?rule.days.map(d=>days[d]).join(', '):rule.repeat==='monthly'?'Day '+rule.monthDay:rule.repeat==='custom'?`Every ${rule.interval} ${rule.unit} · from ${rule.date}`:'Every day';
 return when+' · '+rule.time;
}
export function nextLocalOccurrence(repeat:string,time:string,weekday:number,now=new Date()){
 if(!['daily','weekly'].includes(repeat)||!Number.isInteger(weekday)||weekday<0||weekday>6)throw Error('Invalid schedule time');
 return nextScheduleOccurrence({repeat,time,days:[weekday],date:localDate(now),monthDay:1,interval:1,unit:'days'},now);
}
