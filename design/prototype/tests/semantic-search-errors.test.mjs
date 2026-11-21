import test from 'node:test';
import assert from 'node:assert/strict';
import {semanticSearchOperationMessage} from '../src/semantic-search-errors.ts';

test('missing Search runtime instructions follow the download setting',()=>{
 const error=Error('Runtime not prepared · switch Online to prepare');
 assert.equal(semanticSearchOperationMessage(error,true),'Search runtime is not prepared · choose Prepare runtime.');
 assert.equal(semanticSearchOperationMessage(error,false),'Search runtime is not prepared · turn Online on in Connection settings before preparing it.');
});

test('Search setup preserves unrelated failure detail',()=>{
 assert.equal(semanticSearchOperationMessage(Error('App runtime HTTP request failed'),true),'App runtime HTTP request failed');
 assert.equal(semanticSearchOperationMessage({},false),'Search operation failed');
});
