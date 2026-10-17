// A single revision projection, never a backup or executable configuration.
// @ts-expect-error Canonical baseline is JavaScript.
import {notePath} from '../../../dist/files.js';
export function exportMarkdownRevision(note:any,revision:number){
 if(!note||typeof note.id!=='string')throw Error('Record unavailable');
 if(!Number.isSafeInteger(revision)||revision<1)throw Error('Revision unavailable');
 const selected=note.revisions?.find((v:any)=>v.version===revision);if(!selected||typeof selected.body!=='string')throw Error('Revision unavailable');
 const path=notePath(note,revision),metadata:Record<string,unknown>={id:note.id,version:revision,path,state:note.state,kind:note.kind,sources:note.sources};
 for(const field of ['originalAsset','mediaSource'])if(note[field])metadata[field]={id:note[field].id,revision:note[field].revision,sha256:note[field].sha256};
 for(const field of ['transcription','pdfText','ocrText'])if(note[field])metadata[field]=structuredClone(note[field]);
 const text='---\nbabelshelf: '+JSON.stringify(metadata)+'\n---\n'+selected.body;
 if(new TextDecoder('utf-8',{fatal:true}).decode(new TextEncoder().encode(text))!==text)throw Error('Text cannot be exported as UTF-8');
 const name=path.split('/').at(-1)!;return {filename:name.replace(/\.md$/i,'')+'.v'+revision+'.md',text,path,revision};
}
