import {correctionDiff,type DiffPart} from './correction-diff';

export function CorrectionComparison({before,after}:{before:string;after:string}){
 const diff=correctionDiff(before,after);
 const render=(parts:DiffPart[])=>parts.map((part,index)=>part.changed?<mark className="correction-change" key={index}>{part.text}</mark>:<span key={index}>{part.text}</span>);
 return <><div className="source-revision">{diff.highlighted?'Changes highlighted':'Full text · changes not highlighted'}</div><div className="source-revision">Before</div><div className="file-body">{render(diff.before)}</div><div className="source-revision">After</div><div className="file-body">{render(diff.after)}</div></>;
}
