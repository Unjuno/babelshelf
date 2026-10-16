import {FileText,Microphone,Play} from '@phosphor-icons/react';

export type ReferencePreview={name:string;kind:'text'|'image'|'audio'|'video'|'file';url?:string;excerpt?:string;location?:string};
export function ReferenceCard({source,onOpen}:{source:ReferencePreview;onOpen:()=>void}){
 return <button type="button" className={'reference-card reference-'+source.kind} onClick={onOpen} aria-label={'Open source '+source.name}>
  {source.kind==='image'&&source.url?<img className="reference-media" src={source.url} alt=""/>:source.kind==='video'&&source.url?<div className="reference-video"><video className="reference-media" src={source.url} preload="metadata" muted playsInline/><Play size={26} aria-hidden="true"/></div>:null}
  <span className="reference-heading">{source.kind==='audio'?<Microphone size={20}/>:<FileText size={20}/>}<strong>{source.name}</strong></span>
  {source.location&&<small>{source.location}</small>}
  {source.excerpt&&<span className="reference-excerpt">{source.excerpt}</span>}
  {source.kind==='audio'&&<span className="reference-listen"><Play size={18}/>Listen</span>}
 </button>;
}
