import test from 'node:test';
import assert from 'node:assert/strict';
import {semanticEmbeddingAssetBytes,semanticEmbeddingManifest,validateSemanticEmbeddingConfig} from '../src/semantic-embedding-manifest.ts';

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
