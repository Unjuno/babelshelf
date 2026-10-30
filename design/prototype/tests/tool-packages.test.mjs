import test from 'node:test';
import assert from 'node:assert/strict';
import {run as search} from '../src/tools/memory.search/tool.ts';
import {run as read} from '../src/tools/memory.read/tool.ts';
import {run as list} from '../src/tools/memory.list/tool.ts';
import {listMemoryEntries,resolveToolNotes} from '../src/tools/tool-host.ts';
import {readFile} from 'node:fs/promises';
import {builtinTools} from '../src/tools/builtin-tools.ts';
import {recordOperation,activityLabel,validateActivity} from '../src/harness-activity.ts';

test('every shipped tool can execute through the registry and persist a readable receipt',async()=>{
 const packages=await Promise.all(builtinTools.map(async({tool})=>{
  const id=tool.definition.id;
  return {definition:tool.definition,run:tool.run,entry:`Tools/${id}/tool.ts`,sources:await Promise.all(['SKILL.md','tool.ts'].map(async name=>({path:`Tools/${id}/${name}`,body:await readFile(new URL(`../src/tools/${id}/${name}`,import.meta.url),'utf8')})))};
 }));
 const registry=createToolRegistry(packages),record={id:'saved',path:'Notes/example.md',version:2,body:'Water: 17 litres.'};
 const local={check(){},search:async()=>[{noteId:'saved',revision:2,quote:record.body,start:0,end:record.body.length}],resolve:async query=>resolveToolNotes([record],query),list:async(path,offset,limit)=>listMemoryEntries(path,[record],['Notes'],offset,limit)};
 const inputs={'memory.search':{query:'Water'},'memory.list':{path:'Notes'},'memory.read':{query:'saved'},'math.calculate':{expression:'19*23'},'time.now':{}};
 const results=new Map(),receipts=[];
 for(const capability of registry.capabilities()){
  assert.ok(Object.hasOwn(inputs,capability.id),`Provide an actual execution case for ${capability.id}`);
  const entries=[],args=inputs[capability.id],identity=await registry.identity(capability.id);
  const result=await recordOperation(capability.id,{...args,...identity},()=>registry.run(capability.id,args,local),async activity=>entries.push(activity));
  assert.deepEqual(entries.map(entry=>entry.status),['running','succeeded']);
  assert.equal(entries.at(-1).input.package,capability.id);
  assert.match(entries.at(-1).input.packageSha256,/^[a-f0-9]{64}$/);
  assert.notEqual(activityLabel(capability.id),capability.id);
  results.set(capability.id,result);receipts.push(entries.at(-1));
 }
 validateActivity(JSON.parse(JSON.stringify(receipts)));
 assert.equal(results.get('memory.search')[0].noteId,'saved');
 assert.equal(results.get('memory.list').entries[0].id,'saved');
 assert.deepEqual(results.get('memory.read')[0],{id:'saved',path:'Notes/example.md',version:2,body:'Water: 17 litres.',start:0,totalChars:17});
 assert.equal(results.get('math.calculate')[0].result,'437');
 assert.equal(results.get('time.now').source,'device-clock');
 await assert.rejects(registry.run('shell.exec',{},local),/not registered/);
});
const notes=[{id:'one',path:'Inbox/給水.md',version:2,body:'16 liters'}];
const host={search:async q=>q==='給水'?notes:[],resolve:async q=>resolveToolNotes(notes,q),check(){}};
test('packages return actual host search and exact current snapshot references',async()=>{
 assert.equal(await search({query:'給水'},host),notes);
 for(const query of ['one','Inbox/給水.md','給水.md'])assert.deepEqual((await read({query},host))[0],{...notes[0],start:0,totalChars:notes[0].body.length});
 assert.deepEqual(await read({query:'給水'},host),[]);
});
test('memory.list reveals only immediate folders/files, preserves file identity and pages results',async()=>{
 const snapshot=[...notes,{id:'two',path:'Inbox/sub/second.md',version:4,body:'secret body'},{id:'three',path:'Notes/a.md',version:1,body:'note'}];
 const folders=['Inbox','Inbox/empty','Inbox/sub','Notes'];
 const root=listMemoryEntries('',snapshot,folders),inbox=listMemoryEntries('Inbox',snapshot,folders),sub=listMemoryEntries('Inbox/sub',snapshot,folders);
 assert.deepEqual(root.entries.map(x=>x.path),['Inbox','Notes']);
 assert.deepEqual(inbox.entries.map(x=>[x.kind,x.path]),[['folder','Inbox/empty'],['folder','Inbox/sub'],['file','Inbox/給水.md']]);
 assert.deepEqual(sub.entries,[{kind:'file',name:'second.md',path:'Inbox/sub/second.md',id:'two',version:4}]);
 assert.equal(JSON.stringify(inbox).includes('16 liters'),false);
 const paged=listMemoryEntries('Inbox',snapshot,folders,1,1);assert.equal(paged.hasMore,true);assert.equal(paged.nextOffset,2);
 const actual=await list({path:'Inbox'}, {...host,list:async(path,offset,limit)=>listMemoryEntries(path,snapshot,folders,offset,limit)});
 assert.equal(actual.total,3);
});
test('memory.list rejects traversal, malformed paths and out-of-range pages before host access',async()=>{
 let touched=false;const h={...host,list:async()=>{touched=true;return {};}};
 for(const args of [{path:'../Inbox'},{path:'Inbox/../Notes'},{path:'/Inbox'},{path:'Inbox//sub'},{limit:26},{offset:-1},{unknown:true}])await assert.rejects(list(args,h));
 assert.equal(touched,false);
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

test('memory.read receives only explicitly resolved notes and cannot enumerate the host snapshot',async()=>{
 let resolved='';
 const decorated={...notes[0],history:['old body'],state:'withdrawn',secret:'do-not-expose'};
 const scoped={search:async()=>[],resolve:async query=>{resolved=query;return resolveToolNotes([decorated,{id:'private',path:'Hidden/private.md',version:1,body:'not requested'}],query);},check(){}};
 assert.deepEqual(await read({query:'one',length:10_000_000},scoped),[{...notes[0],start:0,totalChars:notes[0].body.length}]);assert.equal(resolved,'one');assert.equal('views' in scoped,false);assert.equal('history' in (await scoped.resolve('one'))[0],false);assert.equal('secret' in (await scoped.resolve('one'))[0],false);
 assert.deepEqual(await read({query:'Inbox/給水.md',length:10_000_000},scoped),[{...notes[0],start:0,totalChars:notes[0].body.length}]);
});

test('memory.read can continue through exact source ranges without changing the record identity',async()=>{
 const body='αβγδεζηθικλμνξοπρστυφχψω';const source={id:'long',path:'Inbox/long.md',version:4,body};const scoped={...host,resolve:async q=>resolveToolNotes([source],q)};
 const first=(await read({query:source.path,start:0,length:10},scoped))[0],second=(await read({query:source.path,start:first.start+first.body.length,length:10},scoped))[0];
 assert.deepEqual([first.start,first.body,first.totalChars],[0,body.slice(0,10),body.length]);assert.deepEqual([second.start,second.body,second.totalChars],[10,body.slice(10,20),body.length]);assert.equal(first.id,second.id);assert.equal(first.version,second.version);
 await assert.rejects(read({query:source.path,start:-1},scoped),/Invalid Memory range/);await assert.rejects(read({query:source.path,length:0},scoped),/Invalid Memory range/);
});

import {normalizePath} from '../../../dist/files.js';
import {createNote} from '../../../dist/core.js';
import {exportMarkdownRevision} from '../src/markdown-export.ts';
test('tool source paths and export preserve actual code without Markdown wrapping',()=>{
 const path='Tools/memory.search/tool.ts',body="export const label = '原文';\n";
 assert.equal(normalizePath(path),path);assert.equal(normalizePath('Tools/tool-host.ts'),'Tools/tool-host.ts');
 const customPath='Tools/user.date-format/tool.js';assert.equal(normalizePath(customPath),customPath);assert.equal(exportMarkdownRevision(createNote({path:customPath,body:'async () => 1'}),1).filename,'tool.v1.js');
 for(const bad of ['Inbox/tool.ts','Tools/../tool.ts','Tools/a/b/c.ts','Tools/a/tool.js','Tools/a/evil.ts.exe','Tools/User.Test/tool.js'])assert.throws(()=>normalizePath(bad));
 const n=createNote({path,body});const file=exportMarkdownRevision(n,1);assert.equal(file.text,body);assert.equal(file.filename,'tool.v1.ts');
});

import {createToolRegistry} from '../src/tools/tool-registry.ts';
const declaration=()=>({definition:{id:'memory.search',version:1,effect:'read',network:'none'},entry:'Tools/memory.search/tool.ts',sources:[{path:'Tools/memory.search/SKILL.md',body:'Read only'},{path:'Tools/memory.search/tool.ts',body:'source'}],run:search});
test('registry dispatches only trusted registrations and fingerprints immutable code/skill identity',async()=>{
 const pkg=declaration(),registry=createToolRegistry([pkg]),identity=await registry.identity('memory.search');
 assert.match(identity.packageSha256,/^[a-f0-9]{64}$/);assert.equal(identity.entry,pkg.entry);assert.equal(await registry.run('memory.search',{query:'給水'},host),notes);
 pkg.sources[0].body='mutated';pkg.definition.version=2;assert.deepEqual(await registry.identity('memory.search'),identity);
 const changed=createToolRegistry([pkg]);assert.notEqual((await changed.identity('memory.search')).packageSha256,identity.packageSha256);
 await assert.rejects(registry.run('external.run',{},host),/not registered/);await assert.rejects(registry.identity('external.run'),/not registered/);
 const reordered=declaration();reordered.sources.reverse();assert.deepEqual(await createToolRegistry([reordered]).identity('memory.search'),identity);
});
test('registry refuses invalid authority, duplicate IDs, missing code/skill and unsafe source paths',()=>{
 const mutations=[p=>p.definition.network='https',p=>p.definition.effect='unsafe',p=>p.definition.version=0,p=>p.definition.id='../../run',p=>p.run=null,p=>p.entry='Tools/other/tool.ts',p=>p.sources.pop(),p=>p.sources[0].path='Tools/../SKILL.md',p=>p.sources.push({...p.sources[0]})];
 for(const mutate of mutations){const pkg=declaration();mutate(pkg);assert.throws(()=>createToolRegistry([pkg]),/Invalid|unavailable/);}
 assert.throws(()=>createToolRegistry([declaration(),declaration()]),/registration/);
});
test('tool effects and network declarations must form a valid typed contract',()=>{
 for(const mutate of [
  p=>{p.definition.effect='review';p.definition.network='explicit-online';},
  p=>{p.definition.effect='external';p.definition.network='none';},
  p=>{p.definition.network='explicit-online';},
 ]){const pkg=declaration();mutate(pkg);assert.throws(()=>createToolRegistry([pkg]),/Invalid bundled tool registration/);}
 const review=declaration();review.definition.effect='review';assert.equal(createToolRegistry([review]).capabilities()[0].effect,'review');
 const external=declaration();external.definition.effect='external';external.definition.network='explicit-online';assert.equal(createToolRegistry([external]).capabilities()[0].network,'explicit-online');
});

test('registered tool schemas remain stable when their source or exposed capability is changed',async()=>{
 const pkg=declaration();
 pkg.definition.inputSchema={type:'object',required:['query'],properties:{query:{type:'string',maxLength:2000}},additionalProperties:false};
 const expected=structuredClone(pkg.definition.inputSchema),registry=createToolRegistry([pkg]);
 const before=await registry.identity('memory.search');
 pkg.definition.inputSchema.required.push('write');
 pkg.definition.inputSchema.properties.query.type='number';
 assert.deepEqual(registry.capabilities()[0].inputSchema,expected);
 const capability=registry.capabilities()[0];
 assert.throws(()=>capability.inputSchema.required.push('write'),TypeError);
 assert.throws(()=>{capability.inputSchema.properties.query.type='number';},TypeError);
 assert.deepEqual(registry.capabilities()[0].inputSchema,expected);
 assert.deepEqual(await registry.identity('memory.search'),before);
 assert.equal(await registry.run('memory.search',{query:'給水'},host),notes);
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
 assert.equal((await calculator({expression:'2+3'},host))[0].result,'5');
 assert.equal((await calculator({expression:'0.1+0.2'},host))[0].result,'0.3');
 assert.equal((await calculator({expression:'1/3'},host))[0].rounded,true);
 await assert.rejects(calculator({expression:'2+3',write:true},host));
 await assert.rejects(calculator({expression:'2+3'},{...host,check(){throw Error('Stopped')}}),/Stopped/);
});
test('ordered calculation requests preserve stated sequence before model planning',async()=>{
 const {orderedCalculationInput}=await import('../src/tools/math.calculate/tool.ts');
 const cases=[['Calculate the total of 1200 and 800, then divide by 4.',500],['Add 12 and 8, then multiply by 3, then subtract 10',50],['Subtract 3 from 20, then divide by 2',8.5],['Divide 100 by 4, then add 5, then multiply by 2',60],['Calculate (2 + 3) * 4, then divide by -2',-10],['Calculate 1e2, then add .5',100.5],['Calculate the sum of 2 and 3 and 4',9],['12と8を足して。',20],['20から3を引いて',17],['6に7を掛けて',42],['100を4で割る。',25],['−2.5に4を掛ける',-10]];
 for(const [request,result] of cases){const expression=orderedCalculationInput(request);assert.notEqual(expression,null,request);assert.equal(calculate(expression),result,request);}
 for(const request of ['Read the note: Add 2 and 3','Remember Calculate the total of 2 and 3','Calculate the total of 1,200 and 800, then divide by 4','Calculate 2 + 3, then save it','Calculate the total of 2 and 3 divided by 4','Calculate 2026-10-18','Calculate 20%, then add 5','Calculate the total of 2 and 3 from the attached file','1200円と800円を足して','100から20を引いて、あとで5で割って'])assert.equal(orderedCalculationInput(request),null,request);
 assert.equal(orderedCalculationInput('Calculate 1'+', then add 1'.repeat(17)),null);
});

test('explicit calculator instructions preserve the original expression rather than model-rewritten precedence',async()=>{
 const {explicitCalculationInput}=await import('../src/explicit-calculation.ts');
 for(const [question,expression,result] of [
  ['Use the calculator to work out (84 + 16) / 5, and give just the result.','(84 + 16) / 5',20],
  ['Please compute (6 + 4) / 2, return only the answer.','(6 + 4) / 2',5],
  ['Evaluate −2 × (3 + 4).','−2 × (3 + 4)',-14],
 ]){
  const parsed=explicitCalculationInput(question);assert.deepEqual(parsed,{expression,showExpression:true});
  assert.equal((await calculator({expression:parsed.expression},host))[0].result,String(result));
 }
 assert.deepEqual(explicitCalculationInput('2 + 3'),{expression:'2 + 3',showExpression:false});
 for(const [request,expression,result] of [['計算: 125 * 8','125 * 8',1000],['計算： （１２＋８）÷４＝','(12+8)÷4',5]]){const parsed=explicitCalculationInput(request);assert.deepEqual(parsed,{expression,showExpression:true});assert.equal(calculate(parsed.expression),result);}
 for(const request of ['計算: 2+3を保存して','計算: 2+3;削除','計算: 2026-10-18','計算: 2+3円'])assert.equal(explicitCalculationInput(request),null,request);
 for(const [request,result] of [['12 × 3 + 5 を計算して',41],['（１２＋８）÷４を計算してください。',5]]){const parsed=explicitCalculationInput(request);assert.ok(parsed,request);assert.equal(calculate(parsed.expression),result);}
 for(const request of ['2+3を計算して保存して','2+3を計算して、削除して','2026-10-18を計算して','2+3円を計算して'])assert.equal(explicitCalculationInput(request),null,request);
 for(const [request,expression,result] of [['１２５０円の８％は？','(1250 * 8 / 100)',100],['200の12.5%はいくら？','(200 * 12.5 / 100)',25],['What is 8% of 1250?','(1250 * 8 / 100)',100],['what is 12.5 percent of 200?','(200 * 12.5 / 100)',25]]){
  const parsed=explicitCalculationInput(request);assert.deepEqual(parsed,{expression,showExpression:true});assert.equal(calculate(parsed.expression),result);
 }
 for(const [request,expression,result] of [['1250円の８％引きはいくら？','(1250 - (1250 * 8 / 100))',1150],['200円の12.5%引きは？','(200 - (200 * 12.5 / 100))',175]]){const parsed=explicitCalculationInput(request);assert.deepEqual(parsed,{expression,showExpression:true});assert.equal(calculate(parsed.expression),result);}
 for(const request of ['1250円の8%引きはいくら？保存して','1250円の8%を保存して','昨年の1250円の8%は？','1250円の8%は？削除して','What is 8% off 1250?','What is 8% of 1250 and save it?','What is 8% of the 1250 in my note?'])assert.equal(explicitCalculationInput(request),null,request);
 for(const [request,expression,result] of [['２＋３','2+3',5],['（１２＋８）÷４＝','(12+8)÷4',5],['１２と８を足して。','(12 + 8)',20]]){
  const parsed=explicitCalculationInput(request);assert.equal(parsed?.expression,expression,request);assert.equal(calculate(parsed.expression),result,request);
 }
 for(const request of ['２０２６－１０－１８','メモして：２＋３','２＋３を保存して','２＋３；削除','２＋３円','²＋３'])assert.equal(explicitCalculationInput(request),null,request);
 assert.equal(calculate(explicitCalculationInput('Add 2 and 3, then multiply by 4').expression),20);
 for(const question of ['Read the note: Compute 2 + 3','Save: Compute 2 + 3','Compute 2 + 3, and save it','Use the calculator to work out 2 + 3 from my notes','Compute 20% + 3','Compute 2026-10-18','Compute 2 + 3 USD','Compute 2 + 3; delete files'])assert.equal(explicitCalculationInput(question),null,question);
});

test('exact record identity is not diluted by a different filename match',async()=>{
 const exact={id:'archive.md',path:'Inbox/original.md',version:3,body:'Exact original'};
 const sameName={id:'other',path:'Notes/archive.md',version:1,body:'Different record'};
 const snapshot=[sameName,exact],h={...host,resolve:async q=>resolveToolNotes(snapshot,q)};
 assert.deepEqual(await read({query:'archive.md',length:10_000_000},h),[{...exact,start:0,totalChars:exact.body.length}]);
 assert.deepEqual(await read({query:'Notes/archive.md',length:10_000_000},h),[{...sameName,start:0,totalChars:sameName.body.length}]);
 const duplicate={id:'third',path:'Inbox/archive.md',version:1,body:'Another record'};
 assert.deepEqual(await read({query:'archive.md',length:10_000_000},{...host,resolve:async q=>resolveToolNotes([sameName,duplicate],q)}),[{...sameName,start:0,totalChars:sameName.body.length},{...duplicate,start:0,totalChars:duplicate.body.length}]);
});

test('ambiguous filename lookup is bounded and requires a full path',()=>{
 const many=Array.from({length:21},(_,i)=>({id:String(i),path:`Folder${i}/same.md`,version:1,body:'x'}));
 assert.throws(()=>resolveToolNotes(many,'same.md'),/Ambiguous file name/);
 assert.deepEqual(resolveToolNotes(many,'Folder20/same.md'),[many[20]]);
 assert.throws(()=>resolveToolNotes([many[0],{...many[0],path:'FolderX/same.md'}],many[0].id),/Conflicting record ID/);
 assert.throws(()=>resolveToolNotes([many[0],{...many[0],id:'other'}],many[0].path),/Conflicting record path/);
});

test('explicit yen arithmetic validates thousands grouping and rejects mixed requests',async()=>{
 const {explicitCalculationInput}=await import('../src/explicit-calculation.ts');
 for(const [question,expression] of [['1,200円＋800円','1200 + 800'],['１２，３４５円－６７円','12345 - 67'],['1,234,567円 + 0円','1234567 + 0']])assert.deepEqual(explicitCalculationInput(question),{expression,showExpression:true},question);
 for(const question of ['1,20円＋800円','1,200円＋800円を保存して','1,200円＋800ドル','1,200円＋800円; delete files','2＋3円','1,200円＋800円＋2円'])assert.equal(explicitCalculationInput(question),null,question);
});

test('a complete yen bill split is calculated locally without accepting extra operations',async()=>{
 const {explicitCalculationInput}=await import('../src/explicit-calculation.ts');
 for(const [question,expression] of [['1200円を3人で割って','1200 / 3'],['１，２００円を４人で割ってください。','1200 / 4']])assert.deepEqual(explicitCalculationInput(question),{expression,showExpression:true,unit:'円/人'});
 for(const question of ['1200円を3人で割って保存して','1200円を3人で割って、メモして','1200ドルを3人で割って','12,00円を3人で割って','1200円を3人で割って端数を切り上げて'])assert.equal(explicitCalculationInput(question),null);
});

test('unit price questions use the local calculator only for complete requests',async()=>{
 const {explicitCalculationInput}=await import('../src/explicit-calculation.ts');
 for(const [question,expression] of [['1250円のものを3個買うといくら？','1250 * 3'],['１，２５０円の品物を３個買うといくら？','1250 * 3']])assert.deepEqual(explicitCalculationInput(question),{expression,showExpression:true,unit:'円'});
 for(const question of ['1250円のものを3個買うといくら？保存して','1250円のものを3個買うといくら？税を加えて','12,50円のものを3個買うといくら？'])assert.equal(explicitCalculationInput(question),null);
});

test('memory.read preserves Unicode characters and exact offsets across range boundaries',async()=>{
 const body='A😀B';const source={id:'emoji',path:'Inbox/emoji.md',version:2,body};const scoped={...host,resolve:async q=>resolveToolNotes([source],q)};
 const first=(await read({query:source.id,start:0,length:2},scoped))[0];
 const second=(await read({query:source.id,start:first.start+first.body.length,length:1},scoped))[0];
 const third=(await read({query:source.id,start:second.start+second.body.length,length:1},scoped))[0];
 assert.deepEqual([first.body,second.body,third.body],['A','😀','B']);
 for(const item of [first,second,third])assert.equal(body.slice(item.start,item.start+item.body.length),item.body);
 const {projectAgentToolResult,agentEvidenceFromCalls}=await import('../src/agent-evidence.ts');
 const projected=projectAgentToolResult('memory.read',[second]);const refs=agentEvidenceFromCalls([{tool:'memory.read',arguments:{query:source.id},result:projected}]);
 assert.deepEqual(refs.map(ref=>({start:ref.start,end:ref.end,quote:ref.quote})),[{start:1,end:3,quote:'😀'}]);
 const middle=(await read({query:source.id,start:2,length:1},scoped))[0];assert.equal(middle.start,1);assert.equal(middle.body,'😀');
 const after=(await read({query:source.id,start:99,length:1},scoped))[0];assert.equal(after.start,body.length);assert.equal(after.totalChars,body.length);assert.equal(after.body,'');
});
