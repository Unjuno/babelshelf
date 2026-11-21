type SnapshotIdentity={modelId:string;modelRevision:string;sha256:string;bytes:number};
type SnapshotFile=Pick<File,'size'|'lastModified'>;
type FileHandle=Pick<FileSystemFileHandle,'getFile'|'createWritable'>;
type Directory=Pick<FileSystemDirectoryHandle,'getFileHandle'|'removeEntry'>;
const validIdentity=(value:SnapshotIdentity)=>!!value&&typeof value.modelId==='string'&&/^[a-z0-9][a-z0-9._-]{0,119}$/.test(value.modelId)&&typeof value.modelRevision==='string'&&value.modelRevision.length>0&&value.modelRevision.length<=120&&/^[a-f0-9]{64}$/.test(value.sha256)&&Number.isSafeInteger(value.bytes)&&value.bytes>0&&value.bytes<=8*1024**3;
function validFile(file:SnapshotFile,identity:SnapshotIdentity){return Number.isSafeInteger(file?.size)&&file.size===identity.bytes&&Number.isSafeInteger(file.lastModified)&&file.lastModified>0;}
const markerName=(identity:SnapshotIdentity)=>`${identity.sha256}.verified-v1.json`;
function validMarker(value:unknown,identity:SnapshotIdentity,file:SnapshotFile){
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const marker=value as Record<string,unknown>;
 return Object.keys(marker).sort().join('|')==='bytes|lastModified|modelId|modelRevision|schema|sha256'&&marker.schema===1&&marker.modelId===identity.modelId&&marker.modelRevision===identity.modelRevision&&marker.sha256===identity.sha256&&marker.bytes===identity.bytes&&marker.lastModified===file.lastModified;
}
/** A cache hint for immutable content-addressed OPFS snapshots. Explicit verify still hashes every byte. */
export function createVerifiedOpfsSnapshotCache(directory:()=>Promise<Directory>){
 return {
  async isVerified(file:SnapshotFile,identity:SnapshotIdentity){
   if(!validIdentity(identity)||!validFile(file,identity))return false;
   try{
    const root=await directory(),handle=await root.getFileHandle(markerName(identity)),markerFile=await handle.getFile();
    if(markerFile.size>2048)return false;
    return validMarker(JSON.parse(await markerFile.text()),identity,file);
   }catch{return false;}
  },
  async remember(file:SnapshotFile,identity:SnapshotIdentity){
   if(!validIdentity(identity)||!validFile(file,identity))return false;
   const root=await directory(),handle=await root.getFileHandle(markerName(identity),{create:true}),writer=await handle.createWritable();
   try{await writer.write(JSON.stringify({schema:1,...identity,lastModified:file.lastModified}));await writer.close();return true;}
   catch(error){await writer.abort().catch(()=>{});throw error;}
  },
  async forget(identity:SnapshotIdentity){
   if(!validIdentity(identity))return false;
   try{await(await directory()).removeEntry(markerName(identity));return true;}
   catch(error){if(error instanceof Error&&error.name==='NotFoundError')return false;throw error;}
  },
 };
}
