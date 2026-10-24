import baseManifest from '../../../dist/model-manifest.json' with {type:'json'};
import {getLfmTextManifest} from './lfm-text-manifest.ts';
import {getQwen3TextManifest} from './qwen3-text-manifest.ts';
import {getOnnxTextManifest} from './text-model-manifest.ts';
import type {CustomLocalModel} from './preference-records.ts';

export type TextExecutionRoute={engine:'webml-qwen35'|'wllama-lfm2'|'wllama-qwen3'|'transformers-causal-wasm'|'transformers-causal-webgpu';backend:'webgpu'|'cpu-wasm'};
export type TextExecutionIdentity=TextExecutionRoute&{revision:string;runtimeRevision:string};

/** Resolve diagnostics from the same app-owned model registrations used by the text router. */
export function textExecutionRoute(modelId:string,customModels:readonly CustomLocalModel[]=[]):TextExecutionRoute|null{
 const custom=customModels.find(model=>model.id===modelId);
 if(custom){
  if(custom.engine==='webml-qwen35')return {engine:custom.engine,backend:'webgpu'};
  if(custom.engine==='wllama-lfm2'||custom.engine==='wllama-qwen3')return {engine:custom.engine,backend:'cpu-wasm'};
  return null;
 }
 const onnx=getOnnxTextManifest(modelId);
 if(onnx?.engine==='transformers-causal-wasm'&&onnx.device==='wasm')return {engine:'transformers-causal-wasm',backend:'cpu-wasm'};
 if(onnx?.engine==='transformers-causal-webgpu'&&onnx.device==='webgpu')return {engine:'transformers-causal-webgpu',backend:'webgpu'};
 if(getLfmTextManifest(modelId))return {engine:'wllama-lfm2',backend:'cpu-wasm'};
 if(getQwen3TextManifest(modelId))return {engine:'wllama-qwen3',backend:'cpu-wasm'};
 // IDs in the base manifest route through the base WebML backend in TextEngineRouter.
 if(baseManifest.models.some(model=>model.id===modelId))return {engine:'webml-qwen35',backend:'webgpu'};
 return null;
}

/** Resolve the selected model's pinned identity from the same registry as execution routing. */
export function textExecutionIdentity(modelId:string,customModels:readonly CustomLocalModel[]=[]):TextExecutionIdentity|null{
 const route=textExecutionRoute(modelId,customModels);if(!route)return null;
 const custom=customModels.find(model=>model.id===modelId),onnx=getOnnxTextManifest(modelId),lfm=getLfmTextManifest(modelId,customModels),qwen=getQwen3TextManifest(modelId,customModels),base=baseManifest.models.find(model=>model.id===modelId);
 const revision=custom?.revision??onnx?.revision??lfm?.revision??qwen?.revision??base?.revision;
 const runtimeRevision=onnx?.runtime?.revision??lfm?.runtime?.revision??qwen?.runtime?.revision??baseManifest.runtime.revision;
 if(typeof revision!=='string'||!revision||typeof runtimeRevision!=='string'||!runtimeRevision)return null;
 return {...route,revision,runtimeRevision};
}
