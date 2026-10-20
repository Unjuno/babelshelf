import {createSHA256} from 'hash-wasm';
// @ts-expect-error Shared application-owned streaming verifier is JavaScript.
import {configureStreamingSHA256} from '../../../dist/streaming-sha256.js';

// WASM is embedded in the pinned package: no fetch, whole-file buffer or
// permission change. Each hash has its own state; unsupported WASM falls back.
configureStreamingSHA256(async()=>{
 const hash=await createSHA256();
 return {update(bytes:Uint8Array){hash.update(bytes);},hex(){return hash.digest('hex');}};
},'hash-wasm-4.12.0');
