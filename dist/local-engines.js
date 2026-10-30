// App-owned adapters, not executable extensions supplied by a model package.
const catalog=[
 {id:'webml-qwen35',role:'text',format:'GGUF',custom:true},
 {id:'wllama-lfm2',role:'text',format:'GGUF',custom:true},
 {id:'wllama-lfm3',role:'text',format:'GGUF',custom:true},
 {id:'wllama-qwen3',role:'text',format:'GGUF',custom:true},
 {id:'onnx-d1-text',role:'decision',format:'Pinned ONNX graphs',custom:false},
 {id:'transformers-whisper-wasm',role:'speech',format:'Pinned Whisper graphs',custom:false},
 {id:'tesseract-7',role:'ocr',format:'Pinned traineddata',custom:false},
];
export const LOCAL_ENGINES=Object.freeze(catalog.map(entry=>Object.freeze(entry)));
export const localEngine=id=>LOCAL_ENGINES.find(engine=>engine.id===id);
// Eligible to attempt this adapter; never proof of successful execution or quality.
export function eligibleTextEngine(info){
 if(info?.format==='GGUF'&&info.version===3&&info.architecture==='lfm3'&&info.tokenizer==='gpt2'&&info.chatTemplate===true&&info.tensorExtentsChecked===true&&Number.isSafeInteger(info.contextLength)&&info.contextLength>=2048&&Number.isSafeInteger(info.tokenCount)&&info.tokenCount>0&&Array.isArray(info.tensorTypes)&&info.tensorTypes.length>0&&info.tensorTypes.every(type=>[0,2,8,14].includes(type)))return localEngine('wllama-lfm3');
 if(info?.format==='GGUF'&&info.version===3&&info.architecture==='qwen3'&&info.tokenizer==='gpt2'&&info.chatTemplate===true&&info.tensorExtentsChecked===true&&Number.isSafeInteger(info.contextLength)&&info.contextLength>=2048&&Number.isSafeInteger(info.tokenCount)&&info.tokenCount>0&&Array.isArray(info.tensorTypes)&&info.tensorTypes.length>0&&info.tensorTypes.every(type=>[0,2,14,42].includes(type)))return localEngine('wllama-qwen3');
 if(info?.format==='GGUF'&&info.version===3&&info.architecture==='lfm2'&&info.tokenizer==='gpt2'&&info.chatTemplate===true&&info.tensorExtentsChecked===true&&Number.isSafeInteger(info.contextLength)&&info.contextLength>=2048&&Number.isSafeInteger(info.tokenCount)&&info.tokenCount>0&&Array.isArray(info.tensorTypes)&&info.tensorTypes.length>0&&info.tensorTypes.every(type=>[0,2,14].includes(type)))return localEngine('wllama-lfm2');
 if(info?.format!=='GGUF'||info.version!==3||info.architecture!=='qwen35'||info.tokenizer!=='gpt2'||info.chatTemplate!==true||info.tensorExtentsChecked!==true||!Number.isSafeInteger(info.contextLength)||info.contextLength<2048||!Number.isSafeInteger(info.tokenCount)||info.tokenCount<1||!Array.isArray(info.tensorTypes)||!info.tensorTypes.length||info.tensorTypes.some(type=>![0,42,142,143].includes(type)))return undefined;
 return localEngine('webml-qwen35');
}
