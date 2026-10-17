// App-owned classic-worker boundary for the pinned Tesseract 7 protocol.
// Runtime code is supplied as verified immutable same-origin blob URLs.
let booted=false,allowed=new Set();
const nativeImport=self.importScripts.bind(self);
self.fetch=()=>Promise.reject(Error('Network disabled for OCR'));
self.XMLHttpRequest=class{constructor(){throw Error('Network disabled for OCR');}};
self.importScripts=(...urls)=>{if(urls.some(url=>!allowed.has(new URL(url,self.location.href).href)))throw Error('OCR runtime resource blocked');return nativeImport(...urls);};
self.onmessage=event=>{
 const data=event.data;
 if(!booted&&data?.type==='bootstrap'){
  const urls=[data.workerURL,data.coreURL];if(urls.some(url=>typeof url!=='string'||!url.startsWith('blob:')||new URL(url).origin!==self.location.origin))throw Error('OCR runtime resource invalid');allowed=new Set(urls);booted=true;nativeImport(data.workerURL);self.postMessage({bootstrap:'ready'});return;
 }
 const supported=['load','loadLanguage','initialize','setParameters','recognize'];
 if(!booted||!supported.includes(data?.action)||typeof data.jobId!=='string'||data.jobId.length>100||data.action==='load'&&!allowed.has(data.payload?.options?.corePath)||data.action==='loadLanguage'&&(!Array.isArray(data.payload?.langs)||data.payload.langs.some(l=>!['eng','jpn'].includes(l.code)||!(l.data instanceof Uint8Array))||data.payload.options?.cacheMethod!=='none')){
  event.stopImmediatePropagation();throw Error('OCR operation blocked');
 }
};
