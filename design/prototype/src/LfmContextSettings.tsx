type Props={value:number;disabled?:boolean;onChange:(value:number)=>void};
const choices=[8192,16384,32768,65536,131072,262144] as const;
const label=(value:number)=>`${value/1024}K`;

export function LfmContextSettings({value,disabled=false,onChange}:Props){
 return <section aria-label="LFM3 context window">
  <h3 className="model-action-label">Context window</h3>
  <div className="appearance-options" role="group" aria-label="LFM3 context window">
   {choices.map(size=><button key={size} type="button" aria-pressed={value===size} disabled={disabled} onClick={()=>onChange(size)}>{label(size)}</button>)}
  </div>
  <div className="source-revision">Higher context uses more memory. On phones, start with 8K or 16K. 256K is the model maximum, not a recommended phone setting; it can make loading much slower or fail.</div>
  {value>=131072&&<div className="source-revision" role="note">Large context selected · try 8K first if model loading is slow.</div>}
 </section>;
}
