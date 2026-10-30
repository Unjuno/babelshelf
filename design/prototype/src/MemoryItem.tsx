import {useEffect,useRef} from 'react';
import {FolderSimple,FileText,LockSimple,CaretRight,DotsThree} from '@phosphor-icons/react';

export function MemoryItem({label,folder,onOpen,onActions,protectedItem=false,pathProtected=false}:{label:string;folder:boolean;onOpen:()=>void;onActions:()=>void;protectedItem?:boolean;pathProtected?:boolean}) {
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null),held=useRef(false),origin=useRef({x:0,y:0});
 const clear=()=>{if(timer.current)clearTimeout(timer.current);timer.current=null;};
 useEffect(()=>clear,[]);
 return <div className="memory-item" onContextMenu={e=>{e.preventDefault();if(!protectedItem){clear();held.current=true;onActions();}}}>
  <button className={folder?'folder-row directory-row':'file-row'} aria-label={'Open '+label}
   onPointerDown={e=>{clear();held.current=false;origin.current={x:e.clientX,y:e.clientY};if(e.isPrimary&&e.button===0&&!protectedItem)timer.current=setTimeout(()=>{held.current=true;onActions();},450);}}
   onPointerMove={e=>{if(Math.hypot(e.clientX-origin.current.x,e.clientY-origin.current.y)>10)clear();}} onPointerUp={clear} onPointerCancel={clear} onPointerLeave={clear}
   onClick={()=>{if(held.current){held.current=false;return;}onOpen();}}>
   {folder?<FolderSimple size={21}/>:<FileText size={21}/>}<span>{label}</span>{protectedItem&&!folder&&<LockSimple size={14} className="system-lock" aria-label="Read only"/>}{pathProtected&&<span className="protected-label">Fixed path</span>}{folder&&<CaretRight size={17} className="directory-arrow"/>}
  </button>
  {!protectedItem&&<button className="icon-button item-actions" aria-label={'Actions for '+label} onClick={onActions}><DotsThree size={23}/></button>}
 </div>;
}
