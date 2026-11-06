import {useEffect,useRef,useState} from 'react';
import {BottomSheet} from './mobile';
import type {CorrectionTargetOption} from './saved-correction-target';
import type {WorkingFile} from './working-file';

export function useCorrectionTargetChoice(){
 const [choice,setChoice]=useState<CorrectionTargetOption[]|null>(null);
 const pending=useRef<((pin:WorkingFile|null)=>void)|null>(null);
 useEffect(()=>()=>pending.current?.(null),[]);
 function choose(options:CorrectionTargetOption[],signal:AbortSignal){
  if(pending.current||signal.aborted)return Promise.resolve(null);
  return new Promise<WorkingFile|null>(resolve=>{
   const finish=(pin:WorkingFile|null)=>{if(pending.current!==finish)return;pending.current=null;signal.removeEventListener('abort',cancel);setChoice(null);resolve(pin);};
   const cancel=()=>finish(null);pending.current=finish;signal.addEventListener('abort',cancel,{once:true});setChoice(options);
  });
 }
 return {choice,choose,pick:(pin:WorkingFile)=>pending.current?.(pin),cancel:()=>pending.current?.(null)};
}
export function CorrectionTargetSheet({choice,onPick,onCancel}:{choice:CorrectionTargetOption[]|null;onPick:(pin:WorkingFile)=>void;onCancel:()=>void}){
 return <BottomSheet open={choice!==null} onOpenChange={open=>{if(!open)onCancel();}} title="Choose file"><div className="source-preview">{choice?.map(option=><button key={option.noteId+'@'+option.revision} className="settings-action" onClick={()=>onPick(option)}><span>{option.path}</span><span>v{option.revision}</span></button>)}</div><div className="action-row"><button className="quiet-button" onClick={onCancel}>Cancel</button></div></BottomSheet>;
}
