import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {inspectCustomSpeechModel,importCustomSpeechModel,readCustomSpeechFile,speechModelDescriptor,customSpeechRuntimeResponse} from '../src/custom-speech-assets.ts';
const source=()=>[
 new File([JSON.stringify({model_type:'whisper',architectures:['WhisperForConditionalGeneration'],_name_or_path:'My Whisper'})],'config.json'),
 new File([JSON.stringify({model_type:'whisper'})],'generation_config.json'),
 new File([JSON.stringify({feature_extractor_type:'WhisperFeatureExtractor'})],'preprocessor_config.json'),
 new File([JSON.stringify({model:{type:'BPE',vocab:{ok:0}}})],'tokenizer.json'),
 new File([JSON.stringify({tokenizer_class:'WhisperTokenizer'})],'tokenizer_config.json'),
 new File(['{}'],'special_tokens_map.json'),new File([new Uint8Array([1,2,3])],'encoder_model_quantized.onnx',{webkitRelativePath:'model/onnx/encoder_model_quantized.onnx'}),new File([new Uint8Array([4,5,6])],'decoder_model_merged_quantized.onnx',{webkitRelativePath:'model/onnx/decoder_model_merged_quantized.onnx'})
];
test('custom Whisper packages are bounded to the fixed local WASM ONNX adapter',async()=>{
 const files=source(),review=await inspectCustomSpeechModel(files);assert.equal(review.model.role,'speech');assert.equal(review.model.engine,'transformers-whisper-onnx');assert.equal(review.model.label,'My Whisper');assert.equal(review.model.inspection.maxDurationSeconds,120);assert.equal(review.model.files.length,8);assert.equal(review.status,'execution-not-tested');
 await assert.rejects(inspectCustomSpeechModel([...files.slice(0,6),new File(['x'],'other.onnx'),files[7]]),/unsupported|missing/i);
 const incompatible=source();incompatible[0]=new File(['{"model_type":"llama"}'],'config.json');await assert.rejects(inspectCustomSpeechModel(incompatible),/compatible/i);
});
test('custom Whisper bytes are stored and re-read by verified content hash without network',async()=>{
 const review=await inspectCustomSpeechModel(source()),memory=new Map(),events=[];
 const io={directory:async()=>({async getFileHandle(key,options){if(!options?.create){const file=memory.get(key);if(!file)throw Error('Missing');return {getFile:async()=>file};}return {createWritable:async()=>{const chunks=[];return {write:async value=>chunks.push(value),close:async()=>memory.set(key,new File(chunks,key)),abort:async()=>events.push('abort')};}};}}),fetch:async()=>{events.push('network');throw Error('Unexpected network');}};
 assert.deepEqual(await importCustomSpeechModel(review,new AbortController().signal,()=>{},io),review.model);assert.equal(memory.size,8);
 for(const pin of review.model.files){const file=await readCustomSpeechFile(review.model,pin.path,new AbortController().signal,()=>{},io);assert.equal(file.size,pin.bytes);assert.equal(createHash('sha256').update(Buffer.from(await file.arrayBuffer())).digest('hex'),pin.sha256);}
 await assert.rejects(readCustomSpeechFile({...review.model,files:review.model.files.map((pin,i)=>i?pin:{...pin,bytes:pin.bytes+1})},'config.json',new AbortController().signal,()=>{},io),/model/i);assert.ok(!events.includes('network'));
});
test('custom runtime responses resolve only registered local model pins and descriptors retain scope',async()=>{
 const review=await inspectCustomSpeechModel(source()),{model}=review,memory=new Map(model.files.map((pin,i)=>[pin.sha256,review.files[i]])),io={directory:async()=>({getFileHandle:async key=>({getFile:async()=>memory.get(key)})})};
 assert.equal(speechModelDescriptor(model).id,model.id);assert.equal(speechModelDescriptor(model).custom,true);
 const path='/asr-model/'+model.id+'/config.json',response=await customSpeechRuntimeResponse(path,[model],async p=>{const pin=model.files.find(file=>p===file.path);return pin?readCustomSpeechFile(model,pin.path,new AbortController().signal,()=>{},io):undefined;});assert.equal(response.status,200);
 const denied=await customSpeechRuntimeResponse('/asr-model/other/config.json',[model],async()=>undefined);assert.equal(denied.status,404);
});
