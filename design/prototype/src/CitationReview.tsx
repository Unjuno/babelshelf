import type {NoteView} from './knowledge-store';

type Source={noteId:string;revision:number;start:number;quote:string;citedQuote?:string};

/** Show the quoted revision without substituting a newer path when it is unknown. */
export function CitationReview({sources,notes}:{sources:readonly Source[];notes:readonly NoteView[]}){
 if(!sources.length)return null;
 return <details className="creation-sources"><summary>Sources · {sources.length}</summary>{sources.map((ref,index)=>{
  const note=notes.find(item=>item.id===ref.noteId),path=note?.paths?.[ref.revision-1]??(note?.version===ref.revision?note.path:undefined);
  const status=!note?'Unavailable':note.version!==ref.revision?'Changed · current v'+note.version:null;
  return <div key={`${ref.noteId}-${ref.revision}-${ref.start}-${index}`}><strong>{path??'Source '+(index+1)} · v{ref.revision}</strong>{status&&<div role="status">{status}</div>}<p>{ref.citedQuote??ref.quote}</p></div>;
 })}</details>;
}
