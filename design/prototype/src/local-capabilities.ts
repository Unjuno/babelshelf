// App-owned executable adapter declarations. Saved settings/model labels cannot add capabilities.
export type LocalCapability='text.generate'|'decision.classify'|'image.ocr'|'audio.transcribe'|'video.audio'|'video.frames'|'pdf.text'|'image.describe'|'text.embed'|'text.rerank'|'audio.synthesize';
export type LocalAdapter={id:string;engine:string;models:readonly string[];capabilities:readonly LocalCapability[]};
const adapters:readonly LocalAdapter[]=[
 {id:'lfm-text',engine:'wllama-cpu-count',models:['lfm25-350m-qad-q4-0','lfm25-230m-qad-q4-0'],capabilities:['text.generate']},
 {id:'webml-text',engine:'webml',models:['4B','2B','9B'],capabilities:['text.generate']},
 {id:'onnx-text',engine:'transformers-onnx',models:['smollm2-360m-instruct','qwen25-05b-instruct'],capabilities:['text.generate']},
 {id:'d1-text',engine:'onnx-d1',models:['d1-omni-600M'],capabilities:['decision.classify']},
 {id:'whisper',engine:'transformers-onnx',models:['whisper-tiny'],capabilities:['audio.transcribe','video.audio']},
 {id:'tesseract',engine:'tesseract-wasm',models:['tesseract-7'],capabilities:['image.ocr']},
 {id:'lfm-vision',engine:'transformers-onnx-webgpu',models:['lfm25-vl-450m-q4f16'],capabilities:['image.describe']},
 {id:'pdf-text',engine:'pdfjs',models:[],capabilities:['pdf.text']},
];
// Copy/freeze all nested collections: consumers cannot mutate authority through references.
export const localAdapters=Object.freeze(adapters.map(a=>Object.freeze({...a,models:Object.freeze([...a.models]),capabilities:Object.freeze([...a.capabilities])})));
export type CapabilityState={status:'Unsupported'|'Not configured'|'Runtime not connected'|'Not prepared'|'Ready';adapter?:LocalAdapter;model:string;capability:LocalCapability};
// Prepared is a live result supplied by the owning verifier, never a persisted preference.
// Ready means dispatchable, not loaded, accurate, or device acceptance.
export function capabilityState(capability:LocalCapability,model:string,prepared:boolean,customDecisionModels:readonly {id:string;role:string;engine:string}[]=[],customSpeechModels:readonly {id:string;role:string;engine:string}[]=[]):CapabilityState {
 const candidates=localAdapters.filter(a=>a.capabilities.includes(capability));
 const base={capability,model};
 if(!candidates.length)return {...base,status:'Unsupported'};
 const builtin=candidates.find(a=>!a.models.length);
 if(builtin)return {...base,adapter:builtin,status:'Ready'};
 if(!model)return {...base,status:'Not configured'};
 const adapter=candidates.find(a=>a.models.includes(model));
 if(!adapter&&capability==='decision.classify'&&customDecisionModels.some(item=>item.id===model&&item.role==='decision'&&item.engine==='onnx-d1-text'))return {...base,adapter:candidates.find(a=>a.id==='d1-text'),status:prepared===true?'Ready':'Not prepared'};
 if(!adapter&&(capability==='audio.transcribe'||capability==='video.audio')&&customSpeechModels.some(item=>item.id===model&&item.role==='speech'&&item.engine==='transformers-whisper-onnx'))return {...base,adapter:candidates.find(a=>a.id==='whisper'),status:prepared===true?'Ready':'Not prepared'};
 // A registered Vision adapter does not make unrelated model families
 // image-capable. Keep unsupported models visibly distinct from a missing runtime.
 if(!adapter&&capability==='image.describe')return {...base,status:'Unsupported'};
 if(!adapter)return {...base,status:'Runtime not connected'};
 return {...base,adapter,status:prepared===true?'Ready':'Not prepared'};
}
export function requireCapability(capability:LocalCapability,model:string,prepared:boolean):LocalAdapter {
 const state=capabilityState(capability,model,prepared);
 if(state.status!=='Ready'||!state.adapter)throw Error(state.status);
 return state.adapter;
}
export function videoCapabilityStatus(model:string,prepared:boolean,customSpeechModels:readonly {id:string;role:string;engine:string}[]=[]):string {
 const audio=capabilityState('video.audio',model,prepared,[],customSpeechModels);
 return audio.status==='Ready'?'Audio only · frames unsupported':audio.status==='Not configured'?'Speech model required':audio.status+' · audio only';
}
// Verify always rechecks local assets; it never authorizes reacquisition.
export function processorAssetControls(capability:LocalCapability,model:string,ready:boolean,busy:boolean,downloads:boolean,customDecisionModels:readonly {id:string;role:string;engine:string}[]=[],customSpeechModels:readonly {id:string;role:string;engine:string}[]=[]){
 const state=capabilityState(capability,model,ready,customDecisionModels,customSpeechModels),verified=state.status==='Ready';
 if(capability==='audio.transcribe'&&customSpeechModels.some(item=>item.id===model&&item.role==='speech'&&item.engine==='transformers-whisper-onnx'))return {label:verified?'Verify':'Import files',enabled:!busy,allowNetwork:false};
 return {label:verified?'Verify':'Prepare',enabled:!!state.adapter&&!busy&&(verified||downloads),allowNetwork:!verified&&downloads};
}
