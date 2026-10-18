import {webkit} from '../../design/prototype/node_modules/playwright-core/index.mjs';
import {runOfflineProcessCheck} from './offline-process.mjs';
import {appendFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
const root=resolve(process.argv[2]);await mkdir(root,{recursive:false});const log=join(root,'events.jsonl');let writes=Promise.resolve();
const observed={name:()=>webkit.name(),async launchPersistentContext(...args){const context=await webkit.launchPersistentContext(...args);context.on('console',message=>{writes=writes.then(()=>appendFile(log,JSON.stringify({type:message.type(),text:message.text()})+'\n'));});await context.addInitScript(()=>{
 const report=(event,detail)=>console.log('QA-stage '+JSON.stringify({event,detail}));
 for(const method of ['arrayBuffer','text']){const original=Blob.prototype[method];Blob.prototype[method]=function(...args){report('blob-'+method,this.size);return original.apply(this,args).then(value=>{report('blob-'+method+'-done',this.size);return value;});};}
 for(const method of ['getAll','getAllKeys','get','add','put']){const original=IDBObjectStore.prototype[method];IDBObjectStore.prototype[method]=function(...args){report('store-'+method,this.name);const request=original.apply(this,args);request.addEventListener('success',()=>report('store-'+method+'-success',this.name));request.addEventListener('error',()=>report('store-'+method+'-error',this.name));return request;};}
 const transaction=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(...args){report('transaction',args);const tx=transaction.apply(this,args);tx.addEventListener('complete',()=>report('transaction-complete',args));tx.addEventListener('abort',()=>report('transaction-abort',args));return tx;};
});return context;}};
try{await runOfflineProcessCheck(observed,{profileDir:resolve(process.argv[3]),outputDir:join(root,'flow')});}finally{await writes;}
