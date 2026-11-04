type Props={value:number;disabled?:boolean;onChange:(value:number)=>void};

const label=(value:number)=>`${value/1024}K`;

/** Keep high-memory context guidance visible even while the detailed controls are collapsed. */
export function LfmContextNotice({value,disabled=false,onChange}:Props){
 if(value<65536)return null;
 return <div className="model-context-notice" role="note" aria-label={`${label(value)} context may need more memory`}>
  <span>{value>=262144?'256K is the model maximum, not a phone recommendation.':'High memory use · phones: try 16K.'}</span>
  <button type="button" className="quiet-button" disabled={disabled||value===16384} onClick={()=>onChange(16384)}>Use 16K</button>
 </div>;
}
