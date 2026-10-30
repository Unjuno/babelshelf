import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const require=createRequire(import.meta.url),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const {rolldown}=await import('rolldown');
const bundle=await rolldown({input:fileURLToPath(new URL('../src/CitationReview.tsx',import.meta.url)),external:['react','react/jsx-runtime'],transform:{jsx:{runtime:'automatic'}}});
const js=(await bundle.generate({format:'cjs'})).output[0].code;await bundle.close();
const exports={};vm.runInNewContext(js,{exports,require});
const render=(sources,notes)=>renderToStaticMarkup(React.createElement(exports.CitationReview,{sources,notes}));

test('review displays the cited revision path and escapes citation text',()=>{
 const html=render([{noteId:'n',revision:1,start:0,quote:'原文 <script>',citedQuote:'原文 <script>'}],[{id:'n',path:'new.md',version:2,paths:['old.md','new.md']}]);
 assert.match(html,/<summary>Sources · 1<\/summary>/);assert.match(html,/old\.md · v1/);
 assert.match(html,/Changed · current v2/);
 assert.match(html,/原文 &lt;script&gt;/);assert.doesNotMatch(html,/new\.md/);
});

test('review does not substitute a newer path for an unavailable historical path',()=>{
 const html=render([{noteId:'n',revision:1,start:0,quote:'earlier'}],[{id:'n',path:'new.md',version:2}]);
 assert.match(html,/Source 1 · v1/);assert.doesNotMatch(html,/new\.md/);
 assert.match(render([{noteId:'missing',revision:1,start:0,quote:'earlier'}],[]),/Unavailable/);
 assert.equal(render([],[]),'');
});
