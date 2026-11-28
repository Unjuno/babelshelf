import fs from 'node:fs/promises';
import path from 'node:path';

const sourceRoot=path.resolve('design/prototype/src');
const extensions=['.ts','.tsx','.js','.jsx'];
const protectedContracts=new Set(['knowledge-contract.ts','backup-contract.ts','model-registry-contract.ts','harness-preference-contract.ts','reply-style-contract.ts','source-reference-contract.ts','voice-input-contract.ts','text-transform-contract.ts','transcript-citation.ts','input-reading-contract.ts','dialogue-contract.ts','working-file-contract.ts','file-result-contract.ts','original-ref-contract.ts','source-metadata-contract.ts']);
const files=[];
async function collect(directory){
 for(const entry of await fs.readdir(directory,{withFileTypes:true})){
  const file=path.join(directory,entry.name);
  if(entry.isDirectory())await collect(file);
  else if(extensions.some(extension=>file.endsWith(extension)))files.push(file);
 }
}
await collect(sourceRoot);
const fileSet=new Set(files),graph=new Map(files.map(file=>[file,[]]));
function resolveRelative(from,specifier){
 const base=path.resolve(path.dirname(from),specifier);
 return [base,...extensions.map(extension=>base+extension),...['index.ts','index.tsx'].map(file=>path.join(base,file))].find(candidate=>fileSet.has(candidate));
}
for(const file of files){
 const source=await fs.readFile(file,'utf8');
 const staticImport=/\b(?:import|export)\s+(?:type\s+)?(?:[^'";\n]+?\s+from\s+)?['"](\.[^'"]+)['"]/g;
 for(const match of source.matchAll(staticImport)){
  const target=resolveRelative(file,match[1]);
  if(target)graph.get(file).push(target);
 }
}
const contractTypeOwners=new Map([['SourceRef','source-reference-contract.ts'],['VoiceInput','voice-input-contract.ts'],['TextToolReceipt','text-transform-contract.ts'],['AudioRange','transcript-citation.ts'],['InputReadingRef','input-reading-contract.ts'],['CurrentInputRef','input-reading-contract.ts'],['DialogueOutcome','dialogue-contract.ts'],['DialogueTurn','dialogue-contract.ts'],['Dialogue','dialogue-contract.ts'],['DialogueContext','dialogue-contract.ts'],['WorkingFile','working-file-contract.ts'],['FileResult','file-result-contract.ts'],['OriginalRef','original-ref-contract.ts'],['SourceMetadataGuard','source-metadata-contract.ts'],['CustomLocalModel','model-registry-contract.ts'],['CustomDecisionModel','model-registry-contract.ts'],['CustomSpeechModel','model-registry-contract.ts'],['CustomVisionModel','model-registry-contract.ts'],['ModelSetSelection','model-registry-contract.ts'],['UserModelSet','model-registry-contract.ts'],['HarnessProfile','harness-preference-contract.ts'],['HarnessPreferences','harness-preference-contract.ts'],['ReplyStyle','reply-style-contract.ts']]);
for(const [name,owner] of contractTypeOwners){
 const declarations=[];
 for(const file of files){const source=await fs.readFile(file,'utf8');for(const match of source.matchAll(new RegExp(`\\b(?:export\\s+)?type\\s+${name}\\s*=`, 'g')))declarations.push({file,offset:match.index});}
 if(declarations.length!==1||declarations[0].file!==path.join(sourceRoot,owner))throw Error(`${name} must have one declaration in ${owner}`);
}
for(const file of files){
 const source=await fs.readFile(file,'utf8');
 for(const match of source.matchAll(/\b(?:import|export)\s+(?:type\s+)?\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g)){
  const imported=match[1].split(',').map(value=>value.trim().replace(/^type\s+/,'').split(/\s+as\s+/)[0]);
  const misplaced=imported.filter(name=>contractTypeOwners.has(name)&&resolveRelative(file,match[2])!==path.join(sourceRoot,contractTypeOwners.get(name)));
  if(misplaced.length)throw Error(`Contract types must be imported directly from their owner: ${path.relative(sourceRoot,file)} (${misplaced.join(', ')})`);
 }
}
for(const [name,owner] of [['requestNamesWorkingFile','dialogue-request.ts'],['requestNamesEarlierDialogue','dialogue-request.ts'],['planningContextForInputs','dialogue-context-projection.ts']]){
 const declarations=[];
 for(const file of files){const source=await fs.readFile(file,'utf8');for(const match of source.matchAll(new RegExp(`\\bexport\\s+function\\s+${name}\\s*\\(`,'g')))declarations.push(file);}
 if(declarations.length!==1||declarations[0]!==path.join(sourceRoot,owner))throw Error(`${name} must have one implementation in ${owner}`);
}

let nextIndex=0;
const stack=[],onStack=new Set(),indices=new Map(),lowLinks=new Map(),components=[];
function visit(file){
 indices.set(file,nextIndex);lowLinks.set(file,nextIndex++);stack.push(file);onStack.add(file);
 for(const target of graph.get(file)){
  if(!indices.has(target)){visit(target);lowLinks.set(file,Math.min(lowLinks.get(file),lowLinks.get(target)));}
  else if(onStack.has(target))lowLinks.set(file,Math.min(lowLinks.get(file),indices.get(target)));
 }
 if(lowLinks.get(file)!==indices.get(file))return;
 const component=[];let member;
 do{member=stack.pop();onStack.delete(member);component.push(member);}while(member!==file);
 if(component.length>1||graph.get(file).includes(file))components.push(component);
}
for(const file of files)if(!indices.has(file))visit(file);
for(const component of components){
 const protectedMembers=component.filter(file=>protectedContracts.has(path.basename(file)));
 if(protectedMembers.length)throw Error(`Architecture contract participates in a static import cycle: ${protectedMembers.map(file=>path.relative(sourceRoot,file)).join(', ')}`);
}
if(components.length)throw Error(`Source modules must be acyclic; found ${components.length} strongly connected component(s): ${components.map(component=>component.map(file=>path.relative(sourceRoot,file).replaceAll(path.sep,'/')).sort().join(' ↔ ')).join(' | ')}`);

const store=path.join(sourceRoot,'knowledge-store.ts'),backup=path.join(sourceRoot,'backup-state.ts');
const reachable=new Set(),pending=[store];
while(pending.length){const file=pending.pop();if(reachable.has(file))continue;reachable.add(file);for(const target of graph.get(file)??[])pending.push(target);}
if(reachable.has(backup))throw Error('KnowledgeStore static dependency graph must defer backup validation to its operation path');
const conversation=path.join(sourceRoot,'conversation.ts');
for(const owner of ['dialogue-planner.ts','dialogue-agent.ts'])if(graph.get(conversation)?.includes(path.join(sourceRoot,owner)))throw Error(`conversation.ts must not re-export or import ${owner}`);
const edgeCount=[...graph.values()].reduce((count,edges)=>count+edges.length,0);
console.log(`Architecture contracts / deferred backup dependency / acyclic source graph: PASS · ${files.length} source files · ${edgeCount} static imports · 0 cycles`);
