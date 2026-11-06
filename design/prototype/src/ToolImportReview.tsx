import type {CustomToolPackage,CustomToolSourceRecord} from './custom-tool-types';

export function ToolImportReview({pkg,files,profile,saving,error,onCancel,onConfirm}:{pkg:CustomToolPackage;files:readonly CustomToolSourceRecord[];profile:string;saving:boolean;error:string;onCancel:()=>void;onConfirm:()=>void}){
 return <section className="schedule-form creation-form" aria-label="Tool import review">
  <div className="task-fields">
   <h3>Review tool import</h3>
   <div className="file-heading">{pkg.title} · {pkg.id}</div>
   <p>{pkg.skill}</p>
   <div className="source-revision">Local access · {pkg.capabilities.length?pkg.capabilities.join(' · '):'None'}</div>
   <p className="source-revision">Runs on this device in a limited runtime. It can use only the access listed above. No network or file writes.</p>
   <p className="source-revision">Saving adds this tool to the active profile: {profile}. It does not run the tool now.</p>
   {error&&<p role="alert">{error}</p>}
   <details><summary>Input format</summary><pre className="file-body">{JSON.stringify(pkg.inputSchema,null,2)}</pre></details>
   {files.map(file=><details key={file.path}><summary>{file.path.split('/').at(-1)}</summary><pre className="file-body">{file.body}</pre></details>)}
  </div>
  <div className="action-row"><button type="button" className="quiet-button" disabled={saving} onClick={onCancel}>Cancel import</button><button type="button" className="solid-button" disabled={saving} onClick={onConfirm}>{saving?'Saving…':'Save and enable'}</button></div>
 </section>;
}
