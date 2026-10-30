type Props={value:number;disabled?:boolean;onChange:(value:number)=>void};
const choices=[8192,16384,32768,65536,131072,262144] as const;
const label=(value:number)=>`${value/1024}K`;

export function LfmContextSettings({value,disabled=false,onChange}:Props){
 return <section aria-label="LFM3 context window">
  <h3 className="model-action-label">Context window</h3>
  <div className="appearance-options" role="group" aria-label="LFM3 context window">
   {choices.map(size=><button key={size} type="button" aria-pressed={value===size} disabled={disabled} onClick={()=>onChange(size)}>{label(size)}</button>)}
  </div>
  <div className="source-revision">LFM3 supports up to 256K. Larger windows need more memory and may fail on this device.</div>
 </section>;
}
