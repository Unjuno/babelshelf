import {useState} from 'react';
import {KeyboardInput} from './mobile';
import inventory from './generated/package-notices.json';
import appLicense from '../../../LICENSE?raw';
function Notice({name,text,assetName}:{name:string;text?:string;assetName?:string}){
 const [visible,setVisible]=useState(false),[content,setContent]=useState(text??''),[loading,setLoading]=useState(false),[failed,setFailed]=useState(false);
 const toggle=(open:boolean)=>{
  setVisible(open);
  if(!open||!assetName||content||loading)return;
  setFailed(false);setLoading(true);
  const url=new URL(`${import.meta.env.BASE_URL}licenses/${encodeURIComponent(assetName)}`,window.location.href);
  void fetch(url).then(response=>{if(!response.ok)throw Error('Notice unavailable');return response.text();}).then(setContent).catch(()=>setFailed(true)).finally(()=>setLoading(false));
 };
 return <details onToggle={event=>toggle(event.currentTarget.open)}><summary>{name}</summary>{visible&&(loading?<p role="status">Loading notice…</p>:failed?<p role="status">Notice unavailable</p>:<pre className="license-text">{content}</pre>)}</details>;
}
export function LicensesPage(){
 const [query,setQuery]=useState('');const term=query.trim().toLowerCase();
 const packages=inventory.packages.filter(item=>(item.name+' '+item.license).toLowerCase().includes(term));
 const extra=inventory.bundledNotices.filter(name=>name.toLowerCase().includes(term));
 return <div className="help-page licenses-page">
  <section><h2>BabelShelf</h2><Notice name="MIT License" text={appLicense}/></section>
  <section><h2>Models & runtimes</h2><p>Model weights, inference engines and app packages have separate terms.</p><p>LFM3 1.7B model weights use the LFM Open License v1.0. See LFM3-1.7B-LICENSE.txt below.</p><p>Bonsai 2 model weights are listed as Apache-2.0 in the pinned model manifest.</p><p>The WebML Community runtime has no confirmed runtime-specific redistribution license. It is not bundled with this app; explicit preparation downloads it from its upstream source.</p><p>Custom models keep their own terms. Adding a model does not change its license.</p></section>
  <label className="license-search">Find a license<KeyboardInput aria-label="Find a license" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Package or license"/></label>
  <section><h2>Packages</h2><p className="source-revision">{inventory.scope}</p>{packages.map(item=><details key={item.name+'@'+item.version}><summary><span>{item.name}</span><small>{item.version} · {item.license}</small></summary>{item.notices.length?item.notices.map((notice,index)=><Notice key={index} name={notice.name} text={notice.text}/>):<p>License text is not included in this package. Check the bundled notices below. The license label comes from package metadata.</p>}</details>)}{!packages.length&&<p>No matching packages</p>}</section>
  <section><h2>Bundled notices</h2><p className="source-revision">Model terms, runtime notices, fonts and other attributions.</p>{extra.map(name=><Notice key={name} name={name} assetName={name}/>)}{!extra.length&&<p>No matching notices</p>}</section>
 </div>;
}
