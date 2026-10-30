// Reuse one immutable snapshot while its path and size match. The runtime must
// hash a new snapshot before its first load; its path is not proof of content.
export function createRecentPreparedFileReader<T>(read:(id:T)=>Promise<File>,identity:(id:T)=>string,expectedBytes:(id:T)=>number){
 let recent:{key:string;file:File}|null=null;
 return async(id:T)=>{
  const key=identity(id);if(typeof key!=='string'||!key)throw Error('Invalid prepared model identity');
  const bytes=expectedBytes(id),cached=recent;if(!Number.isSafeInteger(bytes)||bytes<1)throw Error('Prepared model size mismatch');
  if(cached&&cached.key===key){if(cached.file.size!==bytes)throw Error('Prepared model size mismatch');return cached.file;}
  const file=await read(id);if(!(file instanceof File))throw Error('Prepared model file unavailable');
  if(!/^[a-f0-9]{64}$/.test(key)||file.name!==key)throw Error('Prepared model identity mismatch');
  if(file.size!==bytes)throw Error('Prepared model size mismatch');
  recent={key,file};return file;
 };
}
