/** Direct OPFS range writes for use inside a dedicated worker. Unlike
 * FileSystemWritableFileStream, a sync access handle updates the existing file
 * without staging a second full-size copy. Callers commit only whole ranges. */
export async function writeOpfsRange(handle:FileSystemFileHandle,start:number,expected:number,reader:ReadableStreamDefaultReader<Uint8Array>,signal:AbortSignal,onBytes:(count:number)=>void){
 const access=await handle.createSyncAccessHandle();let committed=false,ownsRange=false,received=0;
 try{
  // The caller's range offset is a snapshot. Another tab may have committed
  // further ranges before this worker acquired the exclusive access handle.
  // Never roll a newer prefix back to that stale offset.
  if(access.getSize()!==start)throw Error('Model file changed during preparation · retry');
  ownsRange=true;
  while(true){signal.throwIfAborted();const part=await reader.read();signal.throwIfAborted();if(part.done)break;
   if(part.value.byteLength>expected-received)throw Error('Model range exceeds requested size');
   // Count bytes read from the network before attempting storage. A quota
   // error during the write must still report the body that was received.
   const partStart=received;received+=part.value.byteLength;onBytes(part.value.byteLength);
   let offset=0;while(offset<part.value.byteLength){signal.throwIfAborted();const count=access.write(part.value.subarray(offset),{at:start+partStart+offset});if(!Number.isSafeInteger(count)||count<1||count>part.value.byteLength-offset)throw Error('OPFS model range write was incomplete');offset+=count;}
  }
  if(received!==expected)throw Error('Model range incomplete');signal.throwIfAborted();access.flush();committed=true;
 }catch(error){
  // A cancelled/failed range is never considered committed. Restore its
  // aligned starting offset before releasing the exclusive file lock.
  if(ownsRange)try{access.truncate(start);access.flush();}catch{/* A later retry trims to the last aligned boundary. */}
  throw error;
 }finally{try{access.close();}catch{/* preserve the primary range error */}}
 if(!committed)throw Error('Model range was not committed');
}
