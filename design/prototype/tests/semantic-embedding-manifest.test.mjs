import test from 'node:test';
import assert from 'node:assert/strict';
import {semanticEmbeddingAssetBytes,semanticEmbeddingAssetBytesFor,semanticEmbeddingManifest,semanticEmbeddingManifestFor,semanticEmbeddingManifests,validateSemanticEmbeddingConfig} from '../src/semantic-embedding-manifest.ts';

test('semantic embedding pins only the selected multilingual CLS int8 model files and revision',()=>{
 assert.equal(semanticEmbeddingManifest.revision,'536a9f241cb3f02a9c5995a1e708c784bd274859');
 assert.equal(semanticEmbeddingManifest.device,'wasm');
 assert.equal(semanticEmbeddingManifest.pooling,'cls');
 assert.equal(semanticEmbeddingManifest.dimensions,384);
 assert.equal(semanticEmbeddingAssetBytes,123174716);
 assert.equal(semanticEmbeddingManifest.files.find(file=>file.path==='onnx/model_quantized.onnx')?.sha256,'704c1ebca5fbb7cd83ced41827658ac4c9990c64f7f2874d22b78044e5022e22');
 assert.equal(semanticEmbeddingManifest.files.length,5);
});

test('semantic embedding config guard rejects a mismatched graph or tokenizer profile',()=>{
 const config={model_type:'modernbert',architectures:['ModernBertModel'],hidden_size:384,max_position_embeddings:32768,classifier_pooling:'cls'};
 assert.equal(validateSemanticEmbeddingConfig(config),true);
 assert.throws(()=>validateSemanticEmbeddingConfig({...config,hidden_size:768}),/does not match/);
 assert.throws(()=>validateSemanticEmbeddingConfig({...config,architectures:['ModernBertForSequenceClassification']}),/does not match/);
});

test('quality Search profile is pinned to the same local runtime and a separate embedding dimension',()=>{
 const manifest=semanticEmbeddingManifestFor('granite-embedding-311m-multilingual-r2-onnx');
 assert.equal(semanticEmbeddingManifests.length,2);assert.equal(manifest.revision,'8f039f21d4181327268271bea4b11ddcc7eef88d');assert.equal(manifest.dimensions,768);assert.equal(semanticEmbeddingAssetBytesFor(manifest),347099150);
 assert.equal(manifest.files.find(file=>file.path==='onnx/model_quantized.onnx')?.sha256,'54d33d10f865516eda6770d7b0bbf5eaece861058907da0ad095c62e52958c3d');
 assert.equal(validateSemanticEmbeddingConfig({model_type:'modernbert',architectures:['ModernBertModel'],hidden_size:768,max_position_embeddings:32768,classifier_pooling:'cls'},manifest),true);
 assert.throws(()=>validateSemanticEmbeddingConfig({model_type:'modernbert',architectures:['ModernBertModel'],hidden_size:384,max_position_embeddings:32768,classifier_pooling:'cls'},manifest),/does not match/);
});
