export function nextLocalOccurrence(repeat:string,time:string,weekday:number,now=new Date()){
 if(!['daily','weekly'].includes(repeat)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)||!Number.isInteger(weekday)||weekday<0||weekday>6)throw Error('Invalid schedule time');
 const [hour,minute]=time.split(':').map(Number),next=new Date(now);
 next.setHours(hour,minute,0,0);
 if(repeat==='weekly')next.setDate(next.getDate()+(weekday-next.getDay()+7)%7);
 if(next<=now)next.setDate(next.getDate()+(repeat==='weekly'?7:1));
 return next;
}
