import {useEffect,useRef,useState} from 'react';
import {BottomSheet} from './mobile';
import type {SourcedCalculationEvidence,SourcedCalculationProposal} from './sourced-calculation';
import type {SourceRef} from './conversation';

export type CalculationReview={expression:string;question:string;sources:SourceRef[];evidence:SourcedCalculationEvidence[];proposal:SourcedCalculationProposal};

/** The active request owns the review; abort or unmount resolves it as cancelled. */
export function useSourcedCalculationReview(){
 const [candidate,setCandidate]=useState<CalculationReview|null>(null);
 const pending=useRef<((approved:boolean)=>void)|null>(null);
 useEffect(()=>()=>pending.current?.(false),[]);
 function review(value:CalculationReview,signal:AbortSignal):Promise<boolean>{
  if(pending.current||signal.aborted)return Promise.resolve(false);
  return new Promise(resolve=>{
   const finish=(approved:boolean)=>{if(pending.current!==finish)return;pending.current=null;signal.removeEventListener('abort',cancel);setCandidate(null);resolve(approved);};
   const cancel=()=>finish(false);pending.current=finish;signal.addEventListener('abort',cancel,{once:true});setCandidate(structuredClone(value));
  });
 }
 return {candidate,review,approve:()=>pending.current?.(true),cancel:()=>pending.current?.(false)};
}

export function SourcedCalculationSheet({candidate,onApprove,onCancel}:{candidate:CalculationReview|null;onApprove:()=>void;onCancel:()=>void}){
 return <BottomSheet open={candidate!==null} onOpenChange={open=>{if(!open)onCancel();}} title="Review calculation">
  {candidate&&<div className="source-preview"><div className="file-heading">{candidate.question}</div><div className="file-body">{candidate.expression}</div>{candidate.evidence.map(item=><div key={item.operandIndex} className="source-revision"><div>{item.passage.title??'Source'} · v{item.passage.revision}</div><div className="file-body">{item.passage.citedQuote??item.passage.quote}</div><div>{item.source.quote}</div></div>)}<div className="action-row"><button className="quiet-button" onClick={onCancel}>Cancel</button><button className="solid-button" onClick={onApprove}>Calculate</button></div></div>}
 </BottomSheet>;
}
