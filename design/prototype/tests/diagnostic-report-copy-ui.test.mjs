import test from 'node:test';
import assert from 'node:assert/strict';
import {revealAndSelectDiagnosticReport} from '../src/diagnostic-report-copy.ts';

test('reveals the report before selecting it for manual iOS copy',()=>{
 const state={open:false,selected:false};
 const report={};
 const selection={removeAllRanges(){},addRange(range){state.selected=range.node===report;}};
 const nativeDocument={querySelector(selector){if(selector==='.device-test-report')return state;if(selector==='.diagnostic-report')return report;return null;},createRange(){return {selectNodeContents(node){this.node=node;}};}};
 const nativeWindow={getSelection:()=>selection};
 assert.equal(revealAndSelectDiagnosticReport(nativeDocument,nativeWindow),true);
 assert.equal(state.open,true);assert.equal(state.selected,true);
});

test('manual copy fallback safely reports when report text is absent',()=>{
 const nativeDocument={querySelector:()=>null,createRange(){throw Error('must not create range');}};
 const nativeWindow={getSelection:()=>null};
 assert.equal(revealAndSelectDiagnosticReport(nativeDocument,nativeWindow),false);
});

test('manual iOS copy selects the complete Codex handoff, not only the raw JSON report',()=>{
 const state={open:false,children:[],selected:false},report={},field={setAttribute(){},focus(){},select(){state.selected=this.value==='Context + JSON';},setSelectionRange(){}};
 const details={set open(value){state.open=value;},get open(){return state.open;},querySelector(selector){return selector==='.diagnostic-handoff'?state.children[0]??null:null;},appendChild(node){state.children.push(node);}};
 const nativeDocument={querySelector(selector){if(selector==='.device-test-report')return details;if(selector==='.diagnostic-report')return report;return null;},createElement(name){assert.equal(name,'textarea');return field;},createRange(){throw Error('handoff uses textarea selection');}};
 assert.equal(revealAndSelectDiagnosticReport(nativeDocument,{getSelection:()=>null},'Context + JSON'),true);
 assert.equal(state.open,true);assert.equal(state.selected,true);assert.equal(state.children[0],field);
});
