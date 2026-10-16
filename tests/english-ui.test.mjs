import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const html=await fs.readFile('dist/index.html','utf8'),app=await fs.readFile('dist/app.js','utf8');
test('single input surface and bottom Markdown toggle replace chat and sidebar',()=>{assert.ok(!/<aside|>Chat<|>Notes</.test(html));assert.match(html,/<nav class="bottom-toggle"/);assert.match(html,/data-view="notes"[^>]*>Markdown/);assert.ok(!/<p\b/.test(html));});
test('form is IME safe and opens versioned Markdown tree and explicit edit',()=>{assert.ok(app.includes('!e.isComposing'));assert.ok(app.includes('buildFileTree'));assert.ok(html.includes('id="note-path"'));assert.ok(html.includes('id="finish-edit"'));assert.ok(!app.includes('timer=setTimeout(()=>guard(flush),800)'));});
