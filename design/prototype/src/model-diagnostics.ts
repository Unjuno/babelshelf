export type ModelRole='text'|'decision'|'speech'|'ocr'|'vision';
export type ModelIssue={role:ModelRole;label:string};

const issue=(role:ModelRole):ModelIssue=>({role,label:role==='text'?'Text model':role==='speech'?'Speech to text':role==='ocr'?'Image text':role==='vision'?'Image understanding':'Decision model'});

// Only attach a repair when a typed runtime status names the missing dependency.
// Generic/unsupported failures intentionally remain undiagnosed.
export function diagnoseModelIssues(status:string|undefined,attachments:readonly {kind?:string;status?:string}[]=[]):ModelIssue[]{
 const roles:ModelRole[]=[];
 if(status&&/^Model not (?:prepared|configured)(?: · Settings| · remove input file to search Memory)?$/.test(status))roles.push('text');
 if(status==='Analysis not prepared')for(const attachment of attachments){
  if(attachment.status==='Image text not prepared'||attachment.status==='No text layer · OCR required')roles.push('ocr');
  if(attachment.status==='Speech to text not prepared')roles.push('speech');
  if(attachment.status==='Image understanding not prepared')roles.push('vision');
 }
 return [...new Set(roles)].map(issue);
}

export function modelIssueAction(value:ModelIssue){return `Open ${value.label} settings`;}
