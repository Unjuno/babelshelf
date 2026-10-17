import {useEffect,useState} from 'react';
import {knowledge} from './useKnowledge';
import {prepareOriginal,type OriginalAsset,type OriginalRef} from './original-assets';
const EMPTY_REGIONS:number[][]=[];
export function OcrImagePreview({input,regions=EMPTY_REGIONS}:{input:File|OriginalAsset|OriginalRef;regions?:number[][]}){
 const [zoom,setZoom]=useState(1),[image,setImage]=useState(''),[error,setError]=useState('');
 useEffect(()=>{const controller=new AbortController();let url='';setImage('');setError('');void(async()=>{const asset=input instanceof File?await prepareOriginal(input):'data' in input?input:await knowledge.original(input);const {rasterizeImage}=await import('./ocr-raster');const value=await rasterizeImage(asset,controller.signal);if(controller.signal.aborted)return;url=URL.createObjectURL(new Blob([value.bytes.slice().buffer],{type:'image/png'}));setImage(url);})().catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>{controller.abort();if(url)URL.revokeObjectURL(url);};},[input]);
 return <div className="ocr-image-preview"><div className="action-row"><button className="quiet-button" disabled={!image} onClick={()=>setZoom(z=>z===1?2:1)}>{zoom===1?'Zoom in':'Fit image'}</button></div>{error?<div role="alert">{error}</div>:image?<div className="ocr-image-scroll"><div className="ocr-image-frame" style={{width:zoom*100+'%'}}><img src={image} alt="Original image"/>{regions.map((r,i)=><span className="ocr-image-region" key={i} style={{left:r[0]*100+'%',top:r[1]*100+'%',width:r[2]*100+'%',height:r[3]*100+'%'}}/>)}</div></div>:<div role="status">Reading image</div>}</div>;
}
