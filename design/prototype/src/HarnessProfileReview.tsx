import {parsePreference,type HarnessProfile} from './preference-records';
import type {CorrectionProposal} from './note-corrections';
import {builtinTools} from './tools/builtin-tools';

const labels:Record<string,string>=Object.fromEntries(builtinTools.map(({tool,settingsLabel})=>[tool.definition.id,settingsLabel]));
export const profileToolsLabel=(profile:HarnessProfile)=>profile.enabledTools.map(id=>labels[id]??id).join(' · ')||'No tools';

export function HarnessProfileReview({proposal}:{proposal:CorrectionProposal}){
 const {before,after}=proposal;
 const previous=parsePreference('harness',before),next=parsePreference('harness',after);
 const profiles=[previous.profiles.find(p=>p.id===previous.activeProfileId)!,next.profiles.find(p=>p.id===next.activeProfileId)!];
 return <div className="harness-profile-review">{profiles.map((profile,index)=><section key={index} aria-label={index?'Profile after':'Profile before'}>
  <div className="source-revision">{index?'After':'Before'}</div><h3>{profile.label}</h3>
  <p>{profileToolsLabel(profile)}</p>
  <div className="capability-row"><span>Call limit</span><span>{profile.maxToolCalls===null?'No profile limit':profile.maxToolCalls}</span></div>
  <div className="capability-row"><span>Result limit</span><span>{profile.maxResultChars.toLocaleString('en')} chars</span></div>
 </section>)}<p className="source-revision">Read-only tools · no network</p>
 {proposal.dependencies?.length?<details><summary>Tool files</summary>{proposal.dependencies.map(record=>{const version=record.revisions.at(-1);return <details key={record.id}><summary>{version.path} · v{version.version}</summary><pre className="file-body">{version.body}</pre></details>;})}</details>:null}
 <details><summary>File changes</summary><div className="source-revision">Before</div><pre className="file-body">{before}</pre><div className="source-revision">After</div><pre className="file-body">{after}</pre></details></div>;
}
