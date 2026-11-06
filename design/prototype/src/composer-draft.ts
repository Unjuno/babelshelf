import {useCallback,useEffect,useRef,useState,type SetStateAction} from 'react';

export const COMPOSER_DRAFT_KEY='babelshelf.composer-draft.v1';
type DraftStorage=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
type DraftError='read'|'write'|null;

/** Tab-local editing state, never knowledge, an attachment or a submitted turn. */
export function openComposerDraft(storage:()=>DraftStorage){
 let text='',error:DraftError=null;
 try{text=storage().getItem(COMPOSER_DRAFT_KEY)??'';}catch{error='read';}
 return {text,error,save(value:string):DraftError{
  if(typeof value!=='string')throw TypeError('Invalid composer draft');
  try{if(value.length)storage().setItem(COMPOSER_DRAFT_KEY,value);else storage().removeItem(COMPOSER_DRAFT_KEY);return null;}catch{return 'write';}
 }};
}

export function useComposerDraft(){
 const [saved]=useState(()=>openComposerDraft(()=>window.sessionStorage));
 const [text,setText]=useState(saved.text),[error,setError]=useState<DraftError>(saved.error);
 const current=useRef(text);
 const setDraft=useCallback((change:SetStateAction<string>)=>{
  const next=typeof change==='function'?change(current.current):change;
  if(typeof next!=='string')throw TypeError('Invalid composer draft');
  current.current=next;setText(next);setError(saved.save(next));
 },[saved]);
 useEffect(()=>{
  if(error!=='write')return;
  const protect=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
  window.addEventListener('beforeunload',protect);return()=>window.removeEventListener('beforeunload',protect);
 },[error]);
 return [text,setDraft,error] as const;
}
