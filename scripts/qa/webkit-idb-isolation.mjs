import {webkit} from '../../design/prototype/node_modules/playwright-core/index.mjs';
import {writeFile} from 'node:fs/promises';
const evidence={scope:'Windows WebKit native IndexedDB isolation; no product data modified',events:[]};
const c=await webkit.launch({headless:true});const p=await c.newPage();p.on('crash',()=>evidence.events.push('page-crash'));p.on('console',m=>evidence.events.push(m.text()));
try{await p.goto('http://127.0.0.1:4180/');evidence.result=await p.evaluate(async()=>{
 const db=await new Promise((resolve,reject)=>{const q=indexedDB.open('qa-webkit-isolated',1);q.onupgradeneeded=()=>{for(const n of ['notes','settings','runs'])q.result.createObjectStore(n);};q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
 await new Promise((resolve,reject)=>{const tx=db.transaction(['notes','settings','runs'],'readwrite');tx.objectStore('notes').put({body:'Japanese 日本語'},'note');tx.objectStore('settings').put({revision:3,turns:[{text:'Remember note'}]},'dialogue');tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});
 for(let attempt=0;attempt<100;attempt++)await new Promise((resolve,reject)=>{
 const tx=db.transaction(['notes','settings','runs'],'readwrite');const result={notes:[],settings:[],runs:[]};let pending=5;const complete=()=>{if(!--pending)resolve(result);};
 const notes=tx.objectStore('notes').getAll();notes.onsuccess=()=>{result.notes=notes.result;complete();};
 for(const name of ['settings','runs']){const store=tx.objectStore(name),keys=store.getAllKeys(),values=store.getAll();const finish=()=>{if(keys.readyState==='done'&&values.readyState==='done')result[name]=keys.result.map((key,i)=>({key,value:values.result[i]}));};keys.onsuccess=()=>{finish();complete();};values.onsuccess=()=>{finish();complete();};}tx.onabort=()=>reject(tx.error);
 });return '100 exact snapshot readers completed';
});evidence.pass=true;}catch(e){evidence.pass=false;evidence.error=String(e);}finally{await c.close();await writeFile(process.argv[2],JSON.stringify(evidence,null,2));}console.log(JSON.stringify(evidence,null,2));if(!evidence.pass)process.exitCode=1;
