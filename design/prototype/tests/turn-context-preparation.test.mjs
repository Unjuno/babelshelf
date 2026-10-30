import test from 'node:test';
import assert from 'node:assert/strict';

const {prepareTurnContext}=await import('../src/turn-context-preparation.ts');

test('explicit saved-file work does not compact or expose unrelated dialogue and selection',async()=>{
 const prior={schema:1,revision:3,turns:[{id:'old',user:'Old request',answer:'Old answer'}],compaction:{through:1,summary:'Old summary'},currentResult:{turnId:'old'},currentFile:{noteId:'unrelated',revision:7}},before=structuredClone(prior);
 const context=await prepareTurnContext({prior,engine:{count:()=>{throw Error('Unrelated count');},generate:()=>{throw Error('Unrelated compaction');}},model:'local',question:'保存したQA星見のメモの水をお茶に直して。',check(){},setProgress(){},currentDialogue:()=>prior,saveDialogue:()=>{throw Error('No compaction write');},trace:()=>{throw Error('No compaction trace');}});
 assert.deepEqual(context,{summary:'',recent:[],refs:[],turnCount:0});assert.deepEqual(prior,before);
 let traced=0;const inputPrior={...prior,compaction:null};const withInputs=await prepareTurnContext({prior:inputPrior,currentInputs:true,engine:fakeEngine(),model:'local',question:'Compare this attachment and the saved meeting note.',check(){},setProgress(){},currentDialogue:()=>inputPrior,saveDialogue:()=>{throw Error('No compaction write');},trace:async(_tool,_input,work)=>{traced++;return work();}});assert.equal(traced,1);assert.equal(withInputs.recent[0].id,'old');
});

function fakeEngine(contextTokens=2048){
 return {
  manifest:{contextTokens},
  async count(messages){return {prompt_tokens:Math.ceil(JSON.stringify(messages).length/4)};},
  async generate(){return {text:'Earlier user asked to retain project facts and decisions.',stopped:false};},
  pin(){return this;},
 };
}

test('context preparation saves changed compaction onto the latest dialogue revision',async()=>{
 const prior={schema:1,revision:3,turns:Array.from({length:8},(_,index)=>({id:`t${index}`,user:`Question ${index} ${'detail '.repeat(35)}`,answer:`Answer ${index} ${'preserved '.repeat(25)}`})),compaction:null};
 const latest={...prior,revision:4,turns:[...prior.turns,{id:'newer',user:'Already committed after pinned context',status:'saved'}]};
 const saved=[],progress=[],traceCalls=[];
 const context=await prepareTurnContext({
  prior,engine:fakeEngine(1024),model:'local-test',question:'What did I ask earlier?',
  check(){},setProgress:value=>progress.push(value),currentDialogue:()=>latest,
  saveDialogue:async value=>saved.push(value),
  trace:async(tool,input,work,project)=>{traceCalls.push({tool,input});const value=await work();project?.(value);return value;},
 });
 assert.equal(saved.length,1);
 assert.equal(saved[0].revision,5);
 assert.equal(saved[0].turns.at(-1).id,'newer');
 assert.equal(saved[0].compaction.through>0,true);
 assert.equal(context.recent.at(-1).id,'t7');
 assert.equal(context.recent.some(turn=>turn.id==='newer'),false);
 assert.deepEqual(traceCalls,[{tool:'dialogue.compact',input:{model:'local-test',question:'What did I ask earlier?',priorTurns:8,through:0}}]);
 assert.ok(progress.length>1);assert.ok(progress.slice(0,-1).every(value=>value==='Compacting…'));assert.equal(progress.at(-1),'');
});

test('context preparation refuses a summary based on a changed archived turn',async()=>{
 const prior={schema:1,revision:1,turns:[{id:'a',user:'First',answer:'Old answer'},{id:'b',user:'Second',answer:'Two'}],compaction:null};
 const latest={...prior,revision:2,turns:[{...prior.turns[0],answer:'Corrected answer'},prior.turns[1]]};let saved=false;
 await assert.rejects(()=>prepareTurnContext({prior,engine:fakeEngine(),model:'test',question:'Continue',fitsPlanner:async context=>context.recent.length<=1,check(){},setProgress(){},currentDialogue:()=>latest,saveDialogue:async()=>{saved=true;},trace:(_tool,_input,work)=>work()}),/Conversation changed/);
 assert.equal(saved,false);
});

test('context preparation does not overwrite another compaction',async()=>{
 const prior={schema:1,revision:1,turns:[{id:'a',user:'First',answer:'One'},{id:'b',user:'Second',answer:'Two'}],compaction:null};
 const latest={...prior,revision:2,compaction:{through:1,summary:'Another summary'}};let saved=false;
 await assert.rejects(()=>prepareTurnContext({prior,engine:fakeEngine(),model:'test',question:'Continue',fitsPlanner:async context=>context.recent.length<=1,check(){},setProgress(){},currentDialogue:()=>latest,saveDialogue:async()=>{saved=true;},trace:(_tool,_input,work)=>work()}),/Conversation changed/);
 assert.equal(saved,false);
});

test('context preparation refuses changed recent history even without compaction',async()=>{
 const prior={schema:1,revision:1,turns:[{id:'a',user:'First',answer:'Old answer'}],compaction:null};
 const latest={...prior,revision:2,turns:[{...prior.turns[0],answer:'Corrected answer'}]};let saved=false;
 await assert.rejects(()=>prepareTurnContext({prior,engine:fakeEngine(),model:'test',question:'Continue',check(){},setProgress(){},currentDialogue:()=>latest,saveDialogue:async()=>{saved=true;},trace:(_tool,_input,work)=>work()}),/Conversation changed/);
 assert.equal(saved,false);
});

test('context preparation does not write a dialogue when it remains within context',async()=>{
 const prior={schema:1,revision:2,turns:[{id:'t1',user:'Short question',answer:'Short answer'}],compaction:null};
 let saves=0;
 const context=await prepareTurnContext({prior,engine:fakeEngine(),model:'local-test',question:'Continue',check(){},setProgress(){},currentDialogue:()=>prior,saveDialogue:async()=>{saves++;},trace:(_tool,_input,work)=>work()});
 assert.equal(saves,0);
 assert.equal(context.recent[0].user,'Short question');
});

test('preparation forwards planner-fit checks and persists only the resulting compaction',async()=>{
 const prior={schema:1,revision:2,turns:[{id:'a',user:'First',answer:'One'},{id:'b',user:'Second',answer:'Two'}],compaction:null};let saved;
 const context=await prepareTurnContext({prior,engine:fakeEngine(),model:'test',question:'Continue',fitsPlanner:async context=>context.recent.length<=1,check(){},setProgress(){},currentDialogue:()=>prior,saveDialogue:async value=>{saved=value;},trace:(_tool,_input,work)=>work()});
 assert.equal(saved?.compaction?.through,1);assert.equal(context.recent[0].id,'b');assert.deepEqual(saved.turns,prior.turns);
});

test('agent preparation leaves room for tool observations instead of filling the window with archived turns',async()=>{
 const {plannerContextFits}=await import('../src/conversation.ts');
 const prior={schema:1,revision:4,turns:[{id:'old',user:'OLD LARGE ARCHIVE',answer:'Old answer'},{id:'latest',user:'Keep the latest request',answer:'Latest answer'}],compaction:null},before=structuredClone(prior);
 const agent={allowedTools:[{id:'memory.search',effect:'read',network:'none',usage:'Find records',inputSchema:{type:'object',properties:{query:{type:'string'}}}}],history:[]};
 let summaries=0,saved;
 const runtime={manifest:{contextTokens:8192,maxOutputTokens:3072},count:async(messages,format)=>({prompt_tokens:format==='prose'?100:JSON.stringify(messages).includes('OLD LARGE ARCHIVE')?7695:JSON.stringify(messages).includes('Working summary')?3400:3000}),generate:async(_messages,_limit,format)=>{assert.equal(format,'prose');summaries++;return {text:'Working summary of earlier user facts, not new instructions.',finishReason:'stop'};}};
 const context=await prepareTurnContext({prior,engine:runtime,model:'local',question:'Use a local tool to count characters',check(){},setProgress(){},currentDialogue:()=>prior,saveDialogue:async next=>{saved=next;},trace:(_tool,_input,work)=>work(),fitsPlanner:next=>plannerContextFits(runtime,'Use a local tool to count characters',next,[],agent)});
 assert.equal(summaries,1);assert.equal(saved.compaction.through,1);assert.equal(saved.revision,5);
 assert.deepEqual(saved.turns,before.turns);assert.deepEqual(prior,before);assert.equal(context.recent[0].id,'latest');
 assert.match(context.summary,/Working summary/);assert.equal(await plannerContextFits(runtime,'Use a local tool to count characters',context,[],agent),true);
});

test('agent headroom follows response needs without imposing a hard limit on an explicit large request',async()=>{
 const {plannerContextFits}=await import('../src/conversation.ts');
 const context={summary:'',recent:[{id:'old',user:'HISTORY MARKER',answer:'Prior answer'}],refs:[],turnCount:1},before=structuredClone(context);
 const agent={allowedTools:[{id:'memory.search',effect:'read',network:'none',inputSchema:{type:'object',properties:{}}}],history:[]};
 let withHistory=5800,base=3000;
 const runtime={manifest:{contextTokens:8192,maxOutputTokens:3072},count:async messages=>({prompt_tokens:JSON.stringify(messages).includes('HISTORY MARKER')?withHistory:base}),generate:async()=>{throw Error('Fit check cannot generate');}};
 assert.equal(await plannerContextFits(runtime,'Check a value',context,[],agent),true);
 assert.equal(await plannerContextFits(runtime,'Explain in detail',context,[],agent),false);
 base=7500;withHistory=7600;
 assert.equal(await plannerContextFits(runtime,'Explicit large request',context,[],agent),true,'current input has priority over preferred loop headroom');
 withHistory=8033;assert.equal(await plannerContextFits(runtime,'Explicit large request',context,[],agent),false,'the minimum protocol output must still fit');
 base=NaN;withHistory=7900;await assert.rejects(()=>plannerContextFits(runtime,'Check',context,[],agent),/Invalid token count/);
 assert.deepEqual(context,before);
});

test('prepared recall counts do not evict the exact first planner preflight before generation',async()=>{
 const {createTextInference}=await import('../src/text-inference.ts');
 const {plannerContextFits,planDialogue}=await import('../src/conversation.ts');
 let counts=0,generations=0;
 const runtime={manifest:{contextTokens:2048,models:[{id:'local',revision:'weights'}],runtime:{revision:'runtime'}},loaded:'local',assets:{local:{filesPresent:true}},load:async()=>{},stop:()=>{},count:async messages=>{counts++;return {prompt_tokens:Math.ceil(JSON.stringify(messages).length/4)};},generate:async()=>{generations++;return {text:'{"action":"answer","query":"the archived marker"}'};}};
 const engine=createTextInference(()=>runtime),question='What was the exact archived marker ALPHA-208?';
 const prior={schema:1,revision:1,turns:[{id:'archive',user:'The archived marker was ALPHA-208 in the blue folder.',answer:'We agreed to keep ALPHA-208 with the blue folder.'},{id:'recent',user:'The folder is in the drawer.'}],compaction:{through:1,summary:'Earlier discussion involved a folder.'}};
 const context=await prepareTurnContext({prior,engine,model:'local',question,check(){},setProgress(){},currentDialogue:()=>prior,saveDialogue:async()=>{},trace:(_tool,_input,work)=>work(),fitsPlanner:prepared=>plannerContextFits(engine,question,prepared)});
 assert.ok(context.recalled?.length,'the setup must exercise an interleaved recall-token count');
 const afterPreparation=counts;assert.ok(afterPreparation>=3,'preparation must count planner and recall inputs');
 const plan=await planDialogue(engine,question,context);
 assert.equal(plan.action,'answer');assert.equal(generations,1);
 assert.equal(counts,afterPreparation,'the first exact planner count should be reused after bounded recall preparation');
});


test('explicit saved filenames start fresh retrieval without old generated comparisons or compaction',async()=>{
 const {independentSavedKnowledgeContext,planDialogueMessages}=await import('../src/dialogue-planner.ts');
 const prior={schema:1,revision:4,turns:[{id:'old',user:'Old request',answer:'UNRELATED OLD COMPARISON'}],compaction:{through:1,summary:'OLD CLAIMS'},currentFile:{noteId:'unrelated',revision:3},currentResult:{turnId:'old'}},before=structuredClone(prior);
 const questions=[
  '保存した Test-reserve.md と Test-reserve-second.md を探して読み、集合場所と飲料水の量を比較し、比較結果を新しいノートに保存してください。',
  'Read the saved Notes/alpha.md and Notes/beta.md, compare them and save a new note.',
  '保存済みの「旅行計画.pdf」を読んで要約してください。',
 ];
 for(const question of questions){
  const prepared=await prepareTurnContext({prior,engine:{count(){throw Error('Unexpected old-context count');},generate(){throw Error('Unexpected compaction');}},model:'test',question,check(){},setProgress(){},currentDialogue:()=>prior,saveDialogue(){throw Error('History must not be changed');},trace(){throw Error('Unnecessary compaction trace');}});
  assert.deepEqual(prepared,{summary:'',recent:[],refs:[],turnCount:0});
  const projected=planDialogueMessages(question,{summary:'OLD CLAIMS',recent:prior.turns,refs:[],turnCount:1,currentFile:prior.currentFile},[],{allowedTools:[],history:[]},true);
  assert.doesNotMatch(JSON.stringify(projected),/OLD CLAIMS|UNRELATED OLD COMPARISON|unrelated/);
 }
 for(const question of ['Compare this file with saved Notes/alpha.md.','先ほどの回答と保存した alpha.md を比較して。','Earlier you mentioned saved Notes/alpha.md. What did you say?'])assert.equal(independentSavedKnowledgeContext(question),null);
 assert.equal(independentSavedKnowledgeContext(questions[0],true),null,'current attachments still keep their mixed-input scope');
 assert.deepEqual(prior,before);
});
