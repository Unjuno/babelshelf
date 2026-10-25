import {ReaderOperationClient} from './reader-operation-client.ts';
import type {InferenceLease} from './inference-lease.ts';
export class VisionClient extends ReaderOperationClient {
 constructor(factory:()=>any,update:(busy:boolean,progress?:string)=>void,before?:(check:()=>void)=>Promise<void>,acquire?:()=>Promise<InferenceLease>){super('Vision','describe',factory,update,before,acquire);}
}
