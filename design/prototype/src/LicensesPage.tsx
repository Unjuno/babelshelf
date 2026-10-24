import {useState} from 'react';
import {KeyboardInput} from './mobile';
import inventory from './generated/package-notices.json';
import appLicense from '../../../LICENSE?raw';
const bundled=import.meta.glob('../licenses/*.txt',{query:'?raw',import:'default',eager:true}) as Record<string,string>;
const notices=Object.entries(bundled).map(([path,text])=>({name:path.split('/').at(-1)!,text}));
function Notice({name,text}:{name:string;text:string}){
 const [visible,setVisible]=useState(false);
 return <details onToggle={event=>setVisible(event.currentTarget.open)}><summary>{name}</summary>{visible&&<pre className="license-text">{text}</pre>}</details>;
}
export function LicensesPage(){
 const [query,setQuery]=useState('');const term=query.trim().toLowerCase();
 const packages=inventory.packages.filter(item=>(item.name+' '+item.license).toLowerCase().includes(term));
 const extra=notices.filter(item=>item.name.toLowerCase().includes(term));
 return <div className="help-page licenses-page">
  <section><h2>BabelShelf</h2><Notice name="MIT License" text={appLicense}/></section>
  <section><h2>Models & runtimes</h2><p>Model weights, inference engines and app packages have separate terms.</p><p>Bonsai 2 model weights are listed as Apache-2.0 in the pinned model manifest.</p><p>The WebML Community runtime has no confirmed runtime-specific redistribution license. It is not bundled with this app; explicit preparation downloads it from its upstream source.</p><p>Custom models keep their own terms. Adding a model does not change its license.</p></section>
  <label className="license-search">Find a license<KeyboardInput aria-label="Find a license" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Package or license"/></label>
  <section><h2>Packages</h2><p className="source-revision">{inventory.scope}</p>{packages.map(item=><details key={item.name+'@'+item.version}><summary><span>{item.name}</span><small>{item.version} · {item.license}</small></summary>{item.notices.length?item.notices.map((notice,index)=><Notice key={index} name={notice.name} text={notice.text}/>):<p>License text is not included in this package. Check the bundled notices below. The license label comes from package metadata.</p>}</details>)}{!packages.length&&<p>No matching packages</p>}</section>
  <section><h2>Bundled notices</h2><p className="source-revision">Model terms, runtime notices, fonts and other attributions.</p>{extra.map(item=><Notice key={item.name} {...item}/>)}{!extra.length&&<p>No matching notices</p>}</section>
 </div>;
}
