import type {WorkingFile} from './working-file.ts';
import {workingFileNote,workingFileMetadata} from './working-file.ts';

export type CorrectionTargetOption=WorkingFile&{path:string};
/** Discovery nominates current canonical files; a choice is not write approval. */
export async function discoverCorrectionTarget(input:{query:string;search:(query:string)=>Promise<unknown[]>;all:()=>Promise<any[]>;choose?:(options:CorrectionTargetOption[])=>Promise<WorkingFile|null>;check:()=>void}):Promise<CorrectionTargetOption|null>{
 input.check();const hits=await input.search(input.query);input.check();
 if(!Array.isArray(hits)||hits.length>20)throw Error('Invalid file discovery');
 const pins=new Map<string,WorkingFile>();
 for(const hit of hits){
  if(!hit||typeof hit!=='object')throw Error('Invalid file discovery');
  const {noteId,revision}=hit as WorkingFile;if(typeof noteId!=='string'||!noteId||!Number.isSafeInteger(revision)||revision<1)throw Error('Invalid file discovery');
  pins.set(noteId+'@'+revision,{noteId,revision});
 }
 if(!pins.size)throw Error('No matching file');
 const records=await input.all();input.check();
 const options=[...pins.values()].map(pin=>({...pin,path:workingFileMetadata(workingFileNote(records,pin)).path}));
 const selected=options.length===1?options[0]:input.choose?await input.choose(structuredClone(options)):null;input.check();
 if(!selected)return null;
 const option=options.find(item=>item.noteId===selected.noteId&&item.revision===selected.revision);if(!option)throw Error('Invalid file choice');
 return {...option};
}
