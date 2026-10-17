import test from 'node:test';
import assert from 'node:assert/strict';
import {run as search} from '../src/tools/memory.search/tool.ts';
import {run as read} from '../src/tools/memory.read/tool.ts';
const notes=[{id:'one',path:'Inbox/給水.md',version:2,body:'16 liters'}];
const host={search:async q=>q==='給水'?notes:[],views:async()=>notes,check(){}};
test('packages return actual host search and exact current snapshot references',async()=>{
 assert.equal(await search({query:'給水'},host),notes);
 for(const query of ['one','Inbox/給水.md','給水.md'])assert.equal((await read({query},host))[0],notes[0]);
 assert.deepEqual(await read({query:'給水'},host),[]);
});
test('invalid arguments never reach the host',async()=>{
 for(const args of [null,[],{}, {query:''},{query:1},{query:'x',write:true},{query:'x'.repeat(2001)}])
 await assert.rejects(search(args,{...host,search(){throw Error('Host must not run')}}),/Invalid tool/);
});
test('Stop before host and after awaited result refuses completion',async()=>{
 await assert.rejects(read({query:'one'},{...host,check(){throw Error('Stopped')}}),/Stopped/);
 let stopped=false;
 await assert.rejects(search({query:'給水'},{...host,search:async()=>{stopped=true;return notes},check(){if(stopped)throw Error('Stopped')}}),/Stopped/);
});

import {normalizePath} from '../../../dist/files.js';
import {createNote} from '../../../dist/core.js';
import {exportMarkdownRevision} from '../src/markdown-export.ts';
test('tool source paths and export preserve actual code without Markdown wrapping',()=>{
 const path='Tools/memory.search/tool.ts',body="export const label = '原文';\n";
 assert.equal(normalizePath(path),path);assert.equal(normalizePath('Tools/tool-host.ts'),'Tools/tool-host.ts');
 for(const bad of ['Inbox/tool.ts','Tools/../tool.ts','Tools/a/b/c.ts','Tools/a/tool.js','Tools/a/evil.ts.exe'])assert.throws(()=>normalizePath(bad));
 const n=createNote({path,body});const file=exportMarkdownRevision(n,1);assert.equal(file.text,body);assert.equal(file.filename,'tool.v1.ts');
});

import {createToolRegistry} from '../src/tools/tool-registry.ts';
const declaration=()=>({definition:{id:'memory.search',version:1,readOnly:true,network:'none'},entry:'Tools/memory.search/tool.ts',sources:[{path:'Tools/memory.search/SKILL.md',body:'Read only'},{path:'Tools/memory.search/tool.ts',body:'source'}],run:search});
test('registry dispatches only trusted registrations and fingerprints immutable code/skill identity',async()=>{
 const pkg=declaration(),registry=createToolRegistry([pkg]),identity=await registry.identity('memory.search');
 assert.match(identity.packageSha256,/^[a-f0-9]{64}$/);assert.equal(identity.entry,pkg.entry);assert.equal(await registry.run('memory.search',{query:'給水'},host),notes);
 pkg.sources[0].body='mutated';pkg.definition.version=2;assert.deepEqual(await registry.identity('memory.search'),identity);
 const changed=createToolRegistry([pkg]);assert.notEqual((await changed.identity('memory.search')).packageSha256,identity.packageSha256);
 await assert.rejects(registry.run('external.run',{},host),/not registered/);await assert.rejects(registry.identity('external.run'),/not registered/);
 const reordered=declaration();reordered.sources.reverse();assert.deepEqual(await createToolRegistry([reordered]).identity('memory.search'),identity);
});
test('registry refuses invalid authority, duplicate IDs, missing code/skill and unsafe source paths',()=>{
 const mutations=[p=>p.definition.network='https',p=>p.definition.readOnly=false,p=>p.definition.version=0,p=>p.definition.id='../../run',p=>p.run=null,p=>p.entry='Tools/other/tool.ts',p=>p.sources.pop(),p=>p.sources[0].path='Tools/../SKILL.md',p=>p.sources.push({...p.sources[0]})];
 for(const mutate of mutations){const pkg=declaration();mutate(pkg);assert.throws(()=>createToolRegistry([pkg]),/Invalid|unavailable/);}
 assert.throws(()=>createToolRegistry([declaration(),declaration()]),/registration/);
});
test('registry cancellation refuses late results even for a handler that omits its own check',async()=>{
 let stopped=false;const pkg=declaration();pkg.run=async()=>{stopped=true;return notes};const registry=createToolRegistry([pkg]);await assert.rejects(registry.run('memory.search',{}, {...host,check(){if(stopped)throw Error('Stopped')}}),/Stopped/);
});

import {calculate,calculatorInput,run as calculator} from '../src/tools/math.calculate/tool.ts';
test('local arithmetic obeys precedence, signs, bounds and never evaluates code',async()=>{
 assert.equal(calculate('(1200 + 800) / 4'),500);assert.equal(calculate('−2 × (3 + 4)'),-14);
 assert.equal(calculate('1e2 + .5'),100.5);assert.equal(calculate('0.1+0.2'),0.1+0.2);
 for(const s of ['1/0','1e309','2**3','globalThis.alert(1)','1;2','2(3)','('.repeat(40)+'1'+')'.repeat(40)])assert.throws(()=>calculate(s));
 assert.equal(calculatorInput(' (1200 + 800) / 4 = '),'(1200 + 800) / 4');
 for(const s of ['2026-10-18 meeting','read 2+3','what is 2+3','Inbox/a.md'])assert.equal(calculatorInput(s),null);
 assert.equal((await calculator({expression:'2+3'},host))[0].result,5);
 await assert.rejects(calculator({expression:'2+3',write:true},host));
 await assert.rejects(calculator({expression:'2+3'},{...host,check(){throw Error('Stopped')}}),/Stopped/);
});
