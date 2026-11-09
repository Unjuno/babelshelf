import source from './semantic-embedding-manifest.json' with {type:'json'};

export type SemanticEmbeddingFile={path:string;url:string;bytes:number;sha256:string};
export type SemanticEmbeddingManifest={
 schema:1;id:string;name:string;engine:'transformers-feature-extraction-wasm';repository:string;revision:string;
 license:'Apache-2.0';architecture:'modernbert';device:'wasm';dtype:'q8';pooling:'cls';normalize:true;
 dimensions:384;contextTokens:32768;runtime:{name:string;revision:string};files:SemanticEmbeddingFile[];
};

function validate(value:unknown):SemanticEmbeddingManifest{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid semantic embedding manifest');
 const manifest=value as SemanticEmbeddingManifest;
 if(manifest.schema!==1||manifest.id!=='granite-embedding-97m-multilingual-r2-onnx'||manifest.engine!=='transformers-feature-extraction-wasm'||manifest.repository!=='onnx-community/granite-embedding-97m-multilingual-r2-ONNX'||!/^[a-f0-9]{40}$/.test(manifest.revision)||manifest.license!=='Apache-2.0'||manifest.architecture!=='modernbert'||manifest.device!=='wasm'||manifest.dtype!=='q8'||manifest.pooling!=='cls'||manifest.normalize!==true||manifest.dimensions!==384||manifest.contextTokens!==32768||!manifest.runtime?.revision||!Array.isArray(manifest.files)||manifest.files.length!==5)throw Error('Unsupported semantic embedding profile');
 const paths=new Set<string>();
 for(const file of manifest.files){
  if(!file||typeof file.path!=='string'||paths.has(file.path)||!Number.isSafeInteger(file.bytes)||file.bytes<1||!/^[a-f0-9]{64}$/.test(file.sha256))throw Error('Invalid semantic embedding asset pin');
  const url=new URL(file.url),expected=`https://huggingface.co/${manifest.repository}/resolve/${manifest.revision}/${file.path}`;
  if(url.href!==expected)throw Error('Semantic embedding asset URL does not match its pinned revision');
  paths.add(file.path);
 }
 if(!['config.json','special_tokens_map.json','tokenizer.json','tokenizer_config.json','onnx/model_quantized.onnx'].every(path=>paths.has(path)))throw Error('Semantic embedding asset set is incomplete');
 return structuredClone(manifest);
}

export const semanticEmbeddingManifest=validate(source);
export const semanticEmbeddingAssetBytes=semanticEmbeddingManifest.files.reduce((sum,file)=>sum+file.bytes,0);
export function validateSemanticEmbeddingConfig(value:unknown){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid semantic embedding model configuration');
 const config=value as Record<string,unknown>;
 if(config.model_type!==semanticEmbeddingManifest.architecture||!Array.isArray(config.architectures)||!config.architectures.includes('ModernBertModel')||config.hidden_size!==semanticEmbeddingManifest.dimensions||config.max_position_embeddings!==semanticEmbeddingManifest.contextTokens||config.classifier_pooling!==semanticEmbeddingManifest.pooling)throw Error('Semantic embedding model configuration does not match its pinned profile');
 return true;
}
