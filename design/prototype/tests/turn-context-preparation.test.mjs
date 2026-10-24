import test from 'node:test';
import assert from 'node:assert/strict';

const {prepareTurnContext}=await import('../src/turn-context-preparation.ts');

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
 assert.deepEqual(progress,['Compacting…','Compacting…','']);
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
