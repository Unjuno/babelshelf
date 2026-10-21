// Retain only the latest immutable OPFS File snapshot in a Worker. The caller's
// adapter verifies its complete SHA-256 before use and keys its digest cache by
// this exact File object, so storage changes produce a fresh snapshot/hash.
export function createRecentPreparedFileReader<T>(read:(id:T)=>Promise<File>,identity:(id:T)=>string){
 let recent:{key:string;file:File}|null=null;
 return async(id:T)=>{
  const key=identity(id);if(typeof key!=='string'||!key)throw Error('Invalid prepared model identity');
  const cached=recent;if(cached&&cached.key===key)return cached.file;
  const file=await read(id);if(!(file instanceof File))throw Error('Prepared model file unavailable');
  recent={key,file};return file;
 };
}
