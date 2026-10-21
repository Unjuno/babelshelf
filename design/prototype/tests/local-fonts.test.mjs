import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalFontStore} from '../src/local-fonts.ts';

function memoryDirectory(){
 const files=new Map();
 return {
  files,
  async getFileHandle(name,{create=false}={}){
   if(!files.has(name)&&!create)throw Error('Missing file');
   return {
    async getFile(){if(!files.has(name))throw Error('Missing file');return files.get(name);},
    async createWritable(){let chunks=[];return new WritableStream({write(chunk){chunks.push(new Uint8Array(chunk));},close(){files.set(name,new Blob(chunks));}});},
   };
  },
  async removeEntry(name){if(!files.delete(name))throw Error('Missing file');},
 };
}

test('local font import persists verified bytes by content hash and removes them explicitly',async()=>{
 const directory=memoryDirectory(),store=createLocalFontStore({directory:async()=>directory});
 const file=new File([new Uint8Array([0,1,0,0,1,2,3,4])],'Junny Sans.ttf');
 const font=await store.import(file);
 assert.equal(font.label,'Junny Sans');assert.equal(font.format,'ttf');assert.equal(font.bytes,file.size);
 assert.match(font.id,/^font-[a-f0-9]{64}$/);
 assert.deepEqual(new Uint8Array(await store.read(font)),new Uint8Array(await file.arrayBuffer()));
 await store.remove(font);await assert.rejects(store.read(font),/Missing file/);
});

test('local font import rejects unknown signatures and excessive file sizes',async()=>{
 const directory=memoryDirectory(),store=createLocalFontStore({directory:async()=>directory});
 const unknown=new File([new Uint8Array([1,2,3,4])],'nope.bin');
 await assert.rejects(store.import(unknown),/Unsupported font file/);
 const tooLarge=new File([new Uint8Array(20*1024*1024+1)],'large.ttf');
 await assert.rejects(store.import(tooLarge),/4 bytes to 20 MB/);
 assert.equal(directory.files.size,0);
});

test('modified local font bytes fail integrity verification',async()=>{
 const directory=memoryDirectory(),store=createLocalFontStore({directory:async()=>directory});
 const file=new File([new Uint8Array([0,1,0,0,1,2,3,4])],'font.ttf'),font=await store.import(file);
 directory.files.set(font.sha256,new Blob([new Uint8Array([0,1,0,0,8,7,6,5])]));
 await assert.rejects(store.read(font),/Font verification failed/);
});
