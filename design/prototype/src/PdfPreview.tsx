import {useEffect,useState} from 'react';
import {knowledge} from './useKnowledge';
import {prepareOriginal,type OriginalAsset,type OriginalRef} from './original-assets';
const EMPTY_REGIONS:number[][]=[];
export function PdfPreview({input,initialPage=1,regions=EMPTY_REGIONS}:{input:File|OriginalAsset|OriginalRef;initialPage?:number;regions?:number[][]}){
 const [zoom,setZoom]=useState(1),[page,setPage]=useState(initialPage),[result,setResult]=useState<{image:string;pages:number}|null>(null),[error,setError]=useState('');
 useEffect(()=>{const controller=new AbortController();setResult(null);setError('');void(async()=>{const asset=input instanceof File?await prepareOriginal(input):'data' in input?input:await knowledge.original(input);const {renderPdfPage}=await import('./pdf-engine');const value=await renderPdfPage(asset,page,page===initialPage?regions:[],controller.signal);if(!controller.signal.aborted)setResult(value);})().catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();},[input,page,initialPage,regions]);
 return <div className="pdf-preview"><div className="source-revision">Page {page}{result?' / '+result.pages:''}</div><div className="action-row"><button className="quiet-button" disabled={!result||page<=1} onClick={()=>setPage(p=>p-1)}>Previous</button><button className="quiet-button" disabled={!result||page>=result.pages} onClick={()=>setPage(p=>p+1)}>Next</button><button className="quiet-button" disabled={!result} onClick={()=>setZoom(z=>z===1?2:1)}>{zoom===1?'Zoom in':'Fit page'}</button></div>{error?<div role="alert">{error}</div>:result?<div className="pdf-page-scroll"><img style={{width:zoom*100+'%'}} src={result.image} alt={'PDF page '+page}/></div>:<div role="status">Reading PDF</div>}</div>;
}
