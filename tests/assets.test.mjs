import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const mod=await import('../dist/sha256.js').catch(()=>({}));const range=await import('../dist/ranges.js').catch(()=>({}));
test('incremental SHA-256 matches Node crypto across empty, boundary and large chunks',()=>{
 assert.equal(typeof mod.SHA256,'function');
 for(const len of [0,1,55,56,63,64,65,1000,1000000]){const bytes=new Uint8Array(len).map((_,i)=>i%251),h=new mod.SHA256();for(let i=0;i<len;i+=71)h.update(bytes.subarray(i,i+71));assert.equal(h.hex(),createHash('sha256').update(bytes).digest('hex'));}
});
test('offline range responses cover HEAD, bounded, open and suffix requests',async()=>{
 assert.equal(typeof range.fileResponse,'function');const file=new Blob(['0123456789']);
 const full=range.fileResponse(file,{});assert.equal(await full.text(),'0123456789');
 for(const [header,expected] of [['bytes=2-5','2345'],['bytes=7-','789'],['bytes=-3','789']]){const r=range.fileResponse(file,{headers:{Range:header}});assert.equal(r.status,206);assert.equal(await r.text(),expected);}
 assert.equal(range.fileResponse(file,{headers:{Range:'bytes=11-12'}}).status,416);
 assert.equal(range.fileResponse(file,{method:'HEAD'}).headers.get('Content-Length'),'10');
});

test('local model range reads keep exact offsets near and beyond the 9B file size',async()=>{
 assert.equal(typeof range.fileResponse,'function');
 for(const size of [1997486976,2**31+4096]){
  let sliced;
  const file={size,slice(start,end){sliced=[start,end];return new Blob(['0123456789']);}};
  const start=size-10,response=range.fileResponse(file,{headers:{Range:`bytes=${start}-${size-1}`}});
  assert.equal(response.status,206);
  assert.equal(response.headers.get('Content-Range'),`bytes ${start}-${size-1}/${size}`);
  assert.equal(response.headers.get('Content-Length'),'10');
  assert.deepEqual(sliced,[start,size]);
  assert.equal(await response.text(),'0123456789');
  const head=range.fileResponse(file,{method:'HEAD'});
  assert.equal(head.headers.get('Content-Length'),String(size));
 }
});
