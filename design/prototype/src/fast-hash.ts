// @ts-expect-error Shared application-owned streaming verifier is JavaScript.
import {configureStreamingSHA256} from '../../../dist/streaming-sha256.js';

// Load only the SHA-256 entry when a hash is first requested. Importing the
// package-wide barrel put every hash implementation in the application entry
// chunk even though this adapter uses only SHA-256. The standalone pinned UMD
// module embeds its WASM, performs no fetch and adds no permission requirement.
// Each hash has its own state; unsupported WASM falls back to the shared JS path.
configureStreamingSHA256(async()=>{
 // @ts-expect-error The pinned standalone UMD file has no TypeScript declarations.
 const {createSHA256}= (await import('hash-wasm/dist/sha256.umd.min.js')).default as {createSHA256:()=>Promise<{update(bytes:Uint8Array):void;digest(format:'hex'):string}>};
 const hash=await createSHA256();
 return {update(bytes:Uint8Array){hash.update(bytes);},hex(){return hash.digest('hex');}};
},'hash-wasm-4.12.0');
