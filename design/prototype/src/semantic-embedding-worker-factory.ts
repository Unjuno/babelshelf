import SemanticEmbeddingWorker from './semantic-embedding-worker.ts?worker';
import SemanticEmbedding311Worker from './semantic-embedding-311-worker.ts?worker';
import {semanticEmbeddingManifest} from './semantic-embedding-manifest.ts';

/** Vite compiles these TypeScript entry points to executable module workers. */
export function createSemanticEmbeddingWorker(modelId:string){
 return modelId===semanticEmbeddingManifest.id
  ?new SemanticEmbeddingWorker({name:'BabelShelf local embeddings'})
  :new SemanticEmbedding311Worker({name:'BabelShelf local embeddings'});
}
