import '../src/fast-hash.ts';
import {createStreamingSHA256,streamingSHA256Backend} from '../../../dist/streaming-sha256.js';

self.onmessage=async(event:MessageEvent<string>)=>{
 const hash=await createStreamingSHA256();hash.update(new TextEncoder().encode(event.data));
 self.postMessage({digest:hash.hex(),backend:streamingSHA256Backend()});
};
