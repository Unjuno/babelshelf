import test from 'node:test';
import assert from 'node:assert/strict';
import {copyDiagnosticReport} from '../src/diagnostic-report-copy.ts';

function fakeDocument(copyResult=true){
 const state={text:'',selected:false,removed:false,appended:false};
 const textarea={set value(value){state.text=value;},get value(){return state.text;},style:{},setAttribute(){},focus(){},select(){state.selected=true;},setSelectionRange(){},remove(){state.removed=true;}};
 return {state,createElement(name){assert.equal(name,'textarea');return textarea;},body:{appendChild(){state.appended=true;}},execCommand(command){assert.equal(command,'copy');return copyResult;}};
}

test('copies the report through the clipboard when available',async()=>{
 let copied='';
 const result=await copyDiagnosticReport('report-json',{writeText:async value=>{copied=value;}},fakeDocument());
 assert.equal(result,'copied');assert.equal(copied,'report-json');
});

test('falls back to the iOS-compatible selected textarea when clipboard access is unavailable',async()=>{
 const doc=fakeDocument();
 const result=await copyDiagnosticReport('ios-report',{writeText:async()=>{throw Error('denied');}},doc);
 assert.equal(result,'copied');assert.equal(doc.state.text,'ios-report');assert.equal(doc.state.selected,true);assert.equal(doc.state.appended,true);assert.equal(doc.state.removed,true);
});

test('reports when neither clipboard copy path is available',async()=>{
 const doc=fakeDocument(false);
 const result=await copyDiagnosticReport('ios-report',null,doc);
 assert.equal(result,'select');assert.equal(doc.state.selected,true);
});
