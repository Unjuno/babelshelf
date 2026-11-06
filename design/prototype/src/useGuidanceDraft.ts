import {useEffect,useState} from 'react';

// Keep the edit's original value until an explicit save or discard. A refreshed
// Memory snapshot must not silently replace work in progress.
export function useGuidanceDraft(saved:string){
 const [draft,setDraft]=useState(()=>({base:saved,value:saved}));
 useEffect(()=>{setDraft(current=>current.value===current.base&&current.base!==saved?{base:saved,value:saved}:current);},[saved]);
 return {
  ...draft,
  dirty:draft.value!==draft.base,
  conflicted:draft.value!==draft.base&&saved!==draft.base,
  setValue:(value:string)=>setDraft(current=>({...current,value})),
  discard:()=>setDraft({base:saved,value:saved}),
  accept:(submitted:string)=>setDraft(current=>({...current,base:submitted})),
 };
}
