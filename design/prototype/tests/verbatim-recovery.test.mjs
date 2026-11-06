import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareOriginal,originalKey,originalNote} from '../src/original-assets.ts';
import {makeOcrText} from '../src/ocr-text.ts';
import {buildInputReadings,readingRef} from '../src/input-readings.ts';
import {groundedAnswer} from '../src/grounded-answer.ts';

test('verbatim recovery rejects a case-changed identifier and accepts the exact original',async()=>{
 const raw=await prepareOriginal(new File(['image'],'test.png',{type:'image/png'}),'image-input');
 const value=makeOcrText(raw,'eng',{width:10,height:10,processedWidth:10,processedHeight:10,frame:0,orientation:'browser-decoded'},'Access code: AbC123',[]);
 const review={kind:'ocr',id:'case-reading',value};
 const notes=[originalNote(raw),...buildInputReadings([review],[{key:originalKey(raw.id),value:raw}])];
 const store={all:async()=>notes,search:async()=>{throw Error('Unexpected search');}};
 const request={model:'test',question:'What is the access code?',scope:{kind:'attachments',readings:[readingRef(review)]},context:{summary:'',recent:[],refs:[]},check:()=>{}};
 let calls=0,answer='abc123';
 const engine={loaded:'test',assets:{},manifest:{contextTokens:2048,models:[{id:'test',revision:'fixture'}],runtime:{revision:'fixture'}},count:async()=>({prompt_tokens:1}),generate:async()=>({text:JSON.stringify(++calls===1?{code:'AbC123'}:{answer}),finishReason:'stop'})};
 await assert.rejects(groundedAnswer({store,engine},request),/verified quote/);
 calls=0;answer='AbC123';
 const result=await groundedAnswer({store,engine},request);
 assert.equal(result.answer,answer);assert.equal(result.recovery,'verbatim-source');
 assert.equal(result.sources[0].noteId,review.id);assert.ok(result.sources[0].quote.includes(answer));
});
