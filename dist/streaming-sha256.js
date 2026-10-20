import {SHA256} from './sha256.js';
let factory=null,validation=null,label='javascript',active='javascript';
// App-bundled acceleration only; model/configuration records cannot provide code.
export function configureStreamingSHA256(next,name='javascript'){
 if(next!==null&&typeof next!=='function'||typeof name!=='string'||!/^[a-zA-Z0-9.-]{1,64}$/.test(name))throw Error('Invalid SHA-256 backend');
 factory=next;validation=null;label=name;active='javascript';
}
async function validate(create){
 const vectors=[['','e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],['abc','ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],['abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq','248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1']];
 for(const [text,expected]of vectors){const hash=await create();if(typeof hash?.update!=='function'||typeof hash?.hex!=='function')throw Error('Invalid SHA-256 implementation');const bytes=new TextEncoder().encode(text);for(let offset=0;offset<bytes.length;offset+=7)hash.update(bytes.subarray(offset,offset+7));if(hash.hex()!==expected)throw Error('SHA-256 self-test failed');}
}
export async function createStreamingSHA256(){
 const selected=factory;if(!selected)return new SHA256();
 try{await(validation??=validate(selected));if(selected!==factory)return createStreamingSHA256();const hash=await selected();active=label;return hash;}
 catch{if(factory===selected){factory=null;validation=null;active='javascript';}return new SHA256();}
}
export const streamingSHA256Backend=()=>active;
