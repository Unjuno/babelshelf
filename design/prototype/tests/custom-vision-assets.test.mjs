import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inspectCustomVisionModel,importCustomVisionModel,readCustomVisionFile,customVisionModelDescriptor,customVisionRuntimeResponse} from '../src/custom-vision-assets.ts';

const paths=['chat_template.jinja','config.json','generation_config.json','preprocessor_config.json','processor_config.json','tokenizer.json','tokenizer_config.json','onnx/decoder_model_merged_q4f16.onnx','onnx/decoder_model_merged_q4f16.onnx_data','onnx/embed_tokens_q4f16.onnx','onnx/embed_tokens_q4f16.onnx_data','onnx/vision_encoder_q4f16.onnx','onnx/vision_encoder_q4f16.onnx_data'];
const json=(value,name)=>new File([JSON.stringify(value)],name);
const packageFiles=()=>[
 new File(['{{ fixed family template }}'],'chat_template.jinja'),
 json({model_type:'lfm2_vl',architectures:['Lfm2VlForConditionalGeneration'],text_config:{model_type:'lfm2'},vision_config:{model_type:'siglip2_vision_model'},_name_or_path:'Local LFM2-VL'},'config.json'),
 json({eos_token_id:7},'generation_config.json'),
 json({image_processor_type:'Lfm2VlImageProcessor',max_image_tokens:256,processor_class:'Lfm2VlProcessor'},'preprocessor_config.json'),
 json({processor_class:'Lfm2VlProcessor',image_processor:{image_processor_type:'Lfm2VlImageProcessor',max_image_tokens:256}},'processor_config.json'),
 json({model:{type:'BPE',vocab:{hello:0}}},'tokenizer.json'),
 json({processor_class:'Lfm2VlProcessor',tokenizer_class:'TokenizersBackend',chat_template:'bounded template'},'tokenizer_config.json'),
 ...paths.slice(7).map((path,index)=>new File([new Uint8Array([index+1,2,3])],path.split('/').at(-1),{webkitRelativePath:'package/'+path}))
];

test('Vision package inspection admits only bounded LFM2-VL Q4F16 ONNX packages and marks execution untested',async()=>{
 const files=packageFiles(),review=await inspectCustomVisionModel(files);assert.equal(review.model.role,'vision');assert.equal(review.model.engine,'transformers-lfm2-vl-onnx');assert.equal(review.model.label,'Local LFM2-VL');assert.equal(review.model.inspection.architecture,'lfm2_vl');assert.equal(review.model.inspection.device,'webgpu');assert.equal(review.model.files.length,13);assert.equal(review.status,'execution-not-tested');
 const wrong=packageFiles();wrong[1]=json({model_type:'llama',architectures:['LlamaForCausalLM']},'config.json');await assert.rejects(inspectCustomVisionModel(wrong),/compatible/i);
 await assert.rejects(inspectCustomVisionModel([...files.slice(0,-1),new File(['x'],'unexpected.onnx')]),/unsupported|missing/i);
});

test('Vision package import and reads are content-addressed local OPFS files with no network fallback',async()=>{
 const review=await inspectCustomVisionModel(packageFiles()),stored=new Map(),events=[];
 const io={directory:async()=>({async getFileHandle(key,options){if(!options?.create){const file=stored.get(key);if(!file)throw Error('Missing');return {getFile:async()=>file};}return {createWritable:async()=>{const chunks=[];return {write:async value=>chunks.push(value),close:async()=>stored.set(key,new File(chunks,key)),abort:async()=>events.push('abort')};}};}}),fetch:async()=>{events.push('network');throw Error('Unexpected network');}};
 await importCustomVisionModel(review,new AbortController().signal,()=>{},io);assert.equal(stored.size,13);
 for(const pin of review.model.files){const file=await readCustomVisionFile(review.model,pin.path,new AbortController().signal,()=>{},io);assert.equal(createHash('sha256').update(Buffer.from(await file.arrayBuffer())).digest('hex'),pin.sha256);}
 const descriptor=customVisionModelDescriptor(review.model);assert.equal(descriptor.id,review.model.id);assert.equal(descriptor.custom,true);
 const path='/vision-model/'+review.model.id+'/config.json',response=await customVisionRuntimeResponse(path,[review.model],async(_path,model)=>readCustomVisionFile(model,'config.json',new AbortController().signal,()=>{},io));assert.equal(response.status,200);
 const unknown=await customVisionRuntimeResponse('/vision-model/unknown/config.json',[review.model],async()=>undefined);assert.equal(unknown.status,404);assert.ok(!events.includes('network'));
});
