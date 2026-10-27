import test from 'node:test';
import assert from 'node:assert/strict';
import {createToolRegistry} from '../src/tools/tool-registry.ts';
import {runBuiltinTool} from '../src/tools/builtin-tool-results.ts';

function registry(id,value){
 const entry=`Tools/${id}/tool.ts`;
 return createToolRegistry([{definition:{id,version:1,readOnly:true,network:'none'},entry,sources:[{path:`Tools/${id}/SKILL.md`,body:'Read-only tool.'},{path:entry,body:'bundled'}],run:async()=>value}]);
}
const host={check(){},search:async()=>[],resolve:async()=>[]};

test('registered Memory search keeps passages and path-only file results as distinct validated results',async()=>{
 const passage={noteId:'note-1',revision:2,title:'Meeting',start:0,end:11,quote:'Bring water',score:1.5};
 const file={kind:'file',noteId:'note-2',revision:1,path:'Notes/meeting.md'};
 assert.deepEqual(await runBuiltinTool(registry('memory.search',[passage,file]),'memory.search',{query:'meeting'},host),[passage,file]);
 await assert.rejects(runBuiltinTool(registry('memory.search',[{kind:'file',noteId:'note-2',revision:1}]),'memory.search',{query:'meeting'},host),/file result/i);
 await assert.rejects(runBuiltinTool(registry('memory.search',[{...passage,end:13}]),'memory.search',{query:'meeting'},host),/passage/i);
});

test('registered Memory read rejects malformed canonical records before callers project them',async()=>{
 const good=[{id:'note-1',path:'Notes/water.md',version:2,body:'Bring water'}];
 assert.deepEqual(await runBuiltinTool(registry('memory.read',good),'memory.read',{query:'Notes/water.md'},host),good);
 await assert.rejects(runBuiltinTool(registry('memory.read',[{...good[0],version:0}]),'memory.read',{query:'Notes/water.md'},host),/read result/i);
});

test('registered calculator rejects nonfinite or mismatched result records',async()=>{
 const good=[{expression:'6 * 7',result:42,precision:'IEEE-754 binary64'}];
 assert.deepEqual(await runBuiltinTool(registry('math.calculate',good),'math.calculate',{expression:'6 * 7'},host),good);
 await assert.rejects(runBuiltinTool(registry('math.calculate',[{...good[0],result:Infinity}]),'math.calculate',{expression:'6 * 7'},host),/calculation result/i);
 await assert.rejects(runBuiltinTool(registry('math.calculate',[{...good[0],result:41}]),'math.calculate',{expression:'6 * 7'},host),/calculation result/i);
 await assert.rejects(runBuiltinTool(registry('math.calculate',good),'math.calculate',{expression:'2 + 3'},host),/calculation/i);
});

test('decimal results preserve precision and must match the requested expression',async()=>{
 const {makeDecimalReceipt}=await import('../src/decimal-receipt.ts');const receipt=makeDecimalReceipt('0.1+0.2');
 assert.deepEqual(await runBuiltinTool(registry('math.calculate',[receipt]),'math.calculate',{expression:'0.1+0.2'},host),[receipt]);
 await assert.rejects(runBuiltinTool(registry('math.calculate',[receipt]),'math.calculate',{expression:'1+2'},host),/calculation/i);
 await assert.rejects(runBuiltinTool(registry('math.calculate',[{...receipt,result:'0.4'}]),'math.calculate',{expression:'0.1+0.2'},host));
});
