import {FileText} from '@phosphor-icons/react';
import {ReferenceCard} from './ReferenceCard';
import type {SubmissionAttachment} from './submission-workflow';

export type SourceCitationPreviewModel={
 noteId:string;
 revision:number;
 start:number;
 end:number;
 quote:string;
 citedQuote?:string;
 path:string;
 body:string;
 currentAvailable?:boolean;
 currentRevision?:number;
 calculationAnswer?:string;
 original?:SubmissionAttachment;
 vision?:{model:string;revision:string;prompt:string};
};

/** Source sheet presentation only. Source verification and navigation stay in the application boundary. */
export function SourceCitationPreview({source,onClose,onOpenFile,onOpenTrash,onOpenOriginal,canOpenFile,canOpenTrash,openFileLabel}:{
 source:SourceCitationPreviewModel|null;
 onClose:()=>void;
 onOpenFile:()=>void;
 onOpenTrash:()=>void;
 onOpenOriginal:()=>void;
 canOpenFile:boolean;
 canOpenTrash:boolean;
 openFileLabel:string;
}){
 const sourceQuote=source?.body.slice(source.start,source.end),rangeValid=!!source&&source.start>=0&&source.end>source.start&&sourceQuote===source.quote;
 const citedAt=rangeValid&&source?.citedQuote?sourceQuote!.indexOf(source.citedQuote):-1;
 const preciseCitation=citedAt>=0&&source?.citedQuote&&sourceQuote!.indexOf(source.citedQuote,citedAt+1)===-1;
 const highlightStart=source?(preciseCitation?source.start+citedAt:source.start):0,highlightEnd=source?(preciseCitation?highlightStart+source.citedQuote!.length:source.end):0;
 return <div className="source-preview">{source&&<>
  <div className="source-revision">v{source.revision}</div>
  {source.currentAvailable===false?<div className="source-revision">File removed</div>:source.currentRevision!==undefined&&source.currentRevision!==source.revision?<div className="source-revision">Current file · v{source.currentRevision}</div>:null}
  {source.vision&&<div className="source-revision">Vision · {source.vision.model} · {source.vision.revision.slice(0,8)}<br/>{source.vision.prompt}</div>}
  <div className="file-heading"><FileText size={18}/><span>{source.path}</span></div>
  <div className="file-body">{source.calculationAnswer!==undefined?<><div className="source-revision">Calculator</div><mark>{source.calculationAnswer}</mark></>:rangeValid?<>{source.body.slice(0,highlightStart)}<mark>{source.body.slice(highlightStart,highlightEnd)}</mark>{source.body.slice(highlightEnd)}</>:source.body}</div>
  {source.original&&<ReferenceCard source={{name:source.original.name,kind:source.original.kind,url:source.original.url,location:source.original.imageRegion?.label??source.original.pdfPage?.label??source.original.range?.label??'Original · v1'}} onOpen={onOpenOriginal}/>}
 </>}
 <div className="action-row"><button className="quiet-button" onClick={onClose}>Close</button>{canOpenTrash&&<button className="quiet-button" onClick={onOpenTrash}>Open Trash</button>}<button className="solid-button" disabled={!source||!canOpenFile} onClick={onOpenFile}>{openFileLabel}</button></div>
 </div>;
}
