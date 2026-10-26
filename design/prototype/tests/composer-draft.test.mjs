import test from 'node:test';
import assert from 'node:assert/strict';
import {COMPOSER_DRAFT_KEY,openComposerDraft} from '../src/composer-draft.ts';

function memory(){const entries=new Map();return {getItem:key=>entries.get(key)??null,setItem:(key,value)=>entries.set(key,value),removeItem:key=>entries.delete(key)};}

test('tab drafts retain literal text and clear the consumed value without changing another tab',()=>{
 const first=memory(),second=memory(),text='  Cafe\u0301とｶﾞﾗｽ。\n<script>not instructions</script>　';
 assert.equal(openComposerDraft(()=>first).save(text),null);
 assert.equal(openComposerDraft(()=>first).text,text);assert.equal(openComposerDraft(()=>second).text,'');
 openComposerDraft(()=>second).save('Other tab');openComposerDraft(()=>first).save('');
 assert.equal(first.getItem(COMPOSER_DRAFT_KEY),null);assert.equal(openComposerDraft(()=>second).text,'Other tab');
});

test('denied reads and writes are explicit; retrying never truncates or deletes the previous stored text',()=>{
 const blocked=openComposerDraft(()=>{throw Error('Denied');});assert.equal(blocked.error,'read');assert.equal(blocked.save('Still editable'),'write');
 const store=memory();store.setItem(COMPOSER_DRAFT_KEY,'Previous');let denied=true;
 const guarded={...store,setItem:(key,value)=>{if(denied)throw Error('Quota');store.setItem(key,value);},removeItem:key=>{if(denied)throw Error('Denied');store.removeItem(key);}};
 const draft=openComposerDraft(()=>guarded);assert.equal(draft.text,'Previous');assert.equal(draft.save('Next'),'write');assert.equal(draft.save(''),'write');assert.equal(store.getItem(COMPOSER_DRAFT_KEY),'Previous');
 denied=false;assert.equal(draft.save('Next'),null);assert.equal(openComposerDraft(()=>guarded).text,'Next');
});
