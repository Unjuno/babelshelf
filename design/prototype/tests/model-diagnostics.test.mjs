import test from 'node:test';
import assert from 'node:assert/strict';

const {diagnoseModelIssues,modelIssueAction}=await import('../src/model-diagnostics.ts');

test('text model failures identify only the text model settings',()=>{
 assert.deepEqual(diagnoseModelIssues('Model not prepared'),[{role:'text',label:'Text model'}]);
 assert.deepEqual(diagnoseModelIssues('Model not configured · Settings'),[{role:'text',label:'Text model'}]);
 assert.equal(modelIssueAction({role:'text',label:'Text model'}),'Open Text model settings');
});

test('attachment extraction failures identify their own model settings, once each',()=>{
 const attachments=[
  {kind:'image',status:'Image text not prepared'},
  {kind:'audio',status:'Speech to text not prepared'},
  {kind:'video',status:'Speech to text not prepared'},
  {kind:'file',status:'PDF text extracted · 3 / 3 pages'},
 ];
 assert.deepEqual(diagnoseModelIssues('Analysis not prepared',attachments),[
  {role:'ocr',label:'Image text'},
  {role:'speech',label:'Speech to text'},
 ]);
});

test('diagnosis does not infer repairs for unknown or unsupported failures',()=>{
 assert.deepEqual(diagnoseModelIssues('Analysis not prepared',[{kind:'image',status:'Unsupported'}]),[]);
 assert.deepEqual(diagnoseModelIssues('GPU unavailable'),[]);
 assert.deepEqual(diagnoseModelIssues('Model not prepared',[{kind:'audio',status:'Speech to text not prepared'}]),[
  {role:'text',label:'Text model'},
 ]);
});
