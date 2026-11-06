import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyDialogue,appendTurn} from '../src/conversation.ts';
import {makeAnswerCopyReview,reviewedDialogueCopy,validateDialogueCopyRecord} from '../src/dialogue-copy.ts';
import {applyKnowledgeChanges,projectNote} from '../src/knowledge-store.ts';
import {makeStateBackup,parseStateBackup} from '../src/backup-state.ts';
import {exportMarkdownRevision} from '../src/markdown-export.ts';

test('partial answer origin survives save, backup and markdown export',async()=>{
 const state=appendTurn(emptyDialogue(),{id:'partial',user:'Compare',answer:'Only the first.',status:'Partial · incomplete inspection'});
 const copy=reviewedDialogueCopy(state,makeAnswerCopyReview(state,'partial','Only the first.'),'Only the first.');
 assert.equal(copy.dialogueCopyCoverage,'partial');assert.equal(copy.body,'Only the first.');
 const view={id:'saved',path:'Inbox/answer.md',version:1,history:[],...copy};
 const [note]=applyKnowledgeChanges([],[],[view],state);assert.equal(projectNote(note).dialogueCopyCoverage,'partial');
 assert.match(exportMarkdownRevision(note,1).text,/"dialogueCopyCoverage":"partial"/);
 const pack=await makeStateBackup({notes:[note],settings:[{key:'ui-v1-dialogue',value:state}],runs:[]});
 const restored=await parseStateBackup(JSON.stringify(pack));assert.equal(restored.notes[0].dialogueCopyCoverage,'partial');
 const withoutChat=await makeStateBackup({notes:[note],settings:[],runs:[]});
 assert.equal((await parseStateBackup(JSON.stringify(withoutChat))).notes[0].dialogueCopyCoverage,'partial');
 const prior=projectNote(note);
 assert.throws(()=>applyKnowledgeChanges([note],[prior],[{...prior,version:2,history:[prior.body],dialogueCopyCoverage:undefined}],state),/immutable/i);
 const [edited]=applyKnowledgeChanges([note],[prior],[{...prior,body:'Reviewed answer',version:2,history:[prior.body]}],state);
 assert.equal(edited.dialogueCopyCoverage,'partial');
 const changed=structuredClone(state);changed.turns[0].status='Complete';assert.throws(()=>applyKnowledgeChanges([],[],[view],changed),/source changed/i);
 for(const coverage of ['complete',false,null])assert.throws(()=>validateDialogueCopyRecord({...note,dialogueCopyCoverage:coverage}),/copy origin/i);
 const complete=appendTurn(emptyDialogue(),{id:'complete',user:'Compare',answer:'Full answer.'}),full=reviewedDialogueCopy(complete,makeAnswerCopyReview(complete,'complete','Full answer.'),'Full answer.');
 assert.equal(full.dialogueCopyCoverage,undefined);const later=structuredClone(complete);later.turns[0].status='Partial · incomplete inspection';
 assert.throws(()=>applyKnowledgeChanges([],[],[{id:'later',path:'Inbox/later.md',version:1,history:[],...full}],later),/source changed/i);
});
