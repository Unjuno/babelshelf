// Hydration is a read, not a user edit. Explicit changes use serialized CAS.
import {stateHash} from './backup-hash.ts';
export class MetadataWriter<T>{
 private expected:T|undefined;
 private shown='';
 private queue:Promise<void>=Promise.resolve();
 private error:unknown;
 private compare:(before:T|undefined,next:T)=>Promise<void>;
 constructor(compare:(before:T|undefined,next:T)=>Promise<void>){this.compare=compare;}
 hydrate(stored:T|undefined,displayed:T){this.expected=structuredClone(stored);this.shown=stateHash(displayed);this.error=undefined;}
 save(next:T):Promise<void>{
  const hash=stateHash(next);if(hash===this.shown)return this.flush();this.shown=hash;const value=structuredClone(next);
  const operation=this.queue.then(async()=>{if(this.error)throw this.error;await this.compare(this.expected,value);this.expected=value;});
  this.queue=operation.catch(e=>{this.error=e;});return operation;
 }
 async committed(){await this.flush();return structuredClone(this.expected);}
 async flush(){await this.queue;if(this.error)throw this.error;}
}
