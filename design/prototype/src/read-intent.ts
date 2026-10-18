export type ReadCompletion = 'open'|'answer'|'summary';

export type ReadTargetSnapshot = {
 noteId:string;
 path:string;
 revision:number;
 body:string;
};

export type ReadIntentResolution =
 | {kind:'open';status:string;path:string;refs:{noteId:string;revision:number;start:number;end:number;quote:string;title:string}[]}
 | {kind:'continue';action:'answer'|'summary';query:string;workingFile:{noteId:string;revision:number}};

/** Apply the same post-read policy whether a file was already open or found by search. */
export function resolveReadIntent(question:string,completion:ReadCompletion,target:ReadTargetSnapshot):ReadIntentResolution{
 if(typeof question!=='string'||!question.trim())throw Error('Read question missing');
 if(!target||typeof target.noteId!=='string'||!target.noteId||typeof target.path!=='string'||!target.path||!Number.isSafeInteger(target.revision)||target.revision<1||typeof target.body!=='string')throw Error('Read target invalid');
 if(!['open','answer','summary'].includes(completion))throw Error('Read completion invalid');
 if(completion==='open'){
  const quote=target.body.slice(0,700);
  return {kind:'open',path:target.path,status:'Opened · '+target.path,refs:quote?[{noteId:target.noteId,revision:target.revision,start:0,end:quote.length,quote,title:target.path}]:[]};
 }
 return {kind:'continue',action:completion,query:question,workingFile:{noteId:target.noteId,revision:target.revision}};
}
