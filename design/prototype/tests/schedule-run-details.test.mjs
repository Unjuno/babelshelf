import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const require=createRequire(import.meta.url),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const {rolldown}=await import('rolldown');
const bundle=await rolldown({input:fileURLToPath(new URL('../src/ScheduleRunDetails.tsx',import.meta.url)),external:['react','react/jsx-runtime'],transform:{jsx:{runtime:'automatic'}}});
const js=(await bundle.generate({format:'cjs'})).output[0].code;await bundle.close();
const exports={};vm.runInNewContext(js,{exports,require,structuredClone,TextEncoder:globalThis.TextEncoder,TextDecoder:globalThis.TextDecoder});
const {ScheduleRunDetails}=exports;

function body(run){return '# Execution\n\n```json\n'+JSON.stringify(run,null,2)+'\n```\n';}

test('schedule run detail shows a rejected candidate, failure reason and model timing without opening JSON',()=>{
 const markup=renderToStaticMarkup(React.createElement(ScheduleRunDetails,{body:body({
  taskId:'task',taskRevision:2,definition:'fixture',dueAt:'2026-11-20T00:00:00.000Z',attempt:1,owner:'owner',leaseUntil:'2026-11-20T00:01:00.000Z',status:'failed',startedAt:'2026-11-20T00:00:00.000Z',finishedAt:'2026-11-20T00:03:08.000Z',prompt:'say hello briefly',error:'Could not verify a schedule answer · edit the prompt and retry',
  diagnostic:{stage:'answer-validation',reason:'verbatim-source-recovery',candidate:'say hello briefly',model:{id:'lfm3-1.7b-qad-q4-0',runtime:'CPU/WASM'},inference:{measuredModelCalls:2,promptTokens:1024,outputTokens:35,runtimePrefillMs:120000,runtimeDecodeMs:24000,runtimeCachedTokens:289}},
 })}));
 assert.match(markup,/<strong>Failed<\/strong> · Attempt 1 · 3m 8s/);
 assert.match(markup,/Could not verify a schedule answer/);
 assert.match(markup,/The model repeated source text instead of producing a verifiable answer/);
 assert.match(markup,/say hello briefly/);
 assert.match(markup,/lfm3-1\.7b-qad-q4-0 · CPU\/WASM/);
 assert.match(markup,/2 model calls · 1,024 input tokens · 35 output tokens · 289 reused tokens/);
 assert.match(markup,/Input processing 2m 0s/);
 assert.match(markup,/Text generation 24\.000s/);
 assert.match(markup,/<details class="schedule-run-technical-details"><summary>Technical record<\/summary>/);
});

test('schedule run detail keeps earlier retry diagnostics available',()=>{
 const markup=renderToStaticMarkup(React.createElement(ScheduleRunDetails,{body:body({
  taskId:'task',taskRevision:1,definition:'fixture',dueAt:'2026-11-20T00:00:00.000Z',attempt:2,owner:'owner',leaseUntil:'2026-11-20T00:01:00.000Z',status:'failed',startedAt:'2026-11-20T00:00:00.000Z',finishedAt:'2026-11-20T00:00:04.000Z',prompt:'say hello briefly',error:'Runtime stopped',
  attemptHistory:[{attempt:1,status:'failed',startedAt:'2026-11-19T00:00:00.000Z',error:'Could not verify a schedule answer',diagnostic:{stage:'answer-validation',reason:'prompt-echo',candidate:'say hello briefly'}}],
 })}));
 assert.match(markup,/Previous attempt 1 · failed/);
 assert.match(markup,/The model repeated the schedule prompt/);
 assert.match(markup,/say hello briefly/);
});

test('malformed schedule execution records remain readable as their original text',()=>{
 const bodyText='# Execution\n\nrecord unavailable';
 const markup=renderToStaticMarkup(React.createElement(ScheduleRunDetails,{body:bodyText}));
 assert.match(markup,/record unavailable/);
 assert.doesNotMatch(markup,/Schedule run details/);
});
