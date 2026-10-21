export type CopyResult='copied'|'select';

/** Copy a user-requested diagnostic report, falling back to an iOS-selectable textarea. */
export async function copyDiagnosticReport(text:string,clipboard:Pick<Clipboard,'writeText'>|null|undefined,nativeDocument:Pick<Document,'createElement'|'body'|'execCommand'>|null|undefined):Promise<CopyResult>{
 if(clipboard){try{await clipboard.writeText(text);return 'copied';}catch{}}
 if(!nativeDocument?.body)return 'select';
 let field:HTMLTextAreaElement|undefined;
 try{
  field=nativeDocument.createElement('textarea');field.value=text;field.setAttribute('readonly','');field.style.position='fixed';field.style.opacity='0';field.style.pointerEvents='none';field.style.left='0';field.style.top='0';nativeDocument.body.appendChild(field);field.focus();field.select();field.setSelectionRange(0,field.value.length);
  return nativeDocument.execCommand('copy')?'copied':'select';
 }catch{return 'select';}
 finally{field?.remove();}
}
