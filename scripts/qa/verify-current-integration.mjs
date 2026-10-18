// Read-only verification of retained archives; does not launch or simulate inference.
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseStateBackup} from '../../design/prototype/src/backup-state.ts';
import {validateGroundingRefs} from '../../dist/core.js';
const folder=process.argv[2];
assert.ok(folder,'Usage: node scripts/qa/verify-current-integration.mjs OUTPUT_FOLDER');
const evidence=JSON.parse(await readFile(join(folder,'evidence.json'),'utf8'));
assert.equal(evidence.pass,true);const caseId=evidence.caseId??'153';assert.match(caseId,/^\d{3,6}$/);
assert.equal(evidence.phases.length,2);
assert.notEqual(evidence.phases[0].pid,evidence.phases[1].pid);
for(const phase of evidence.phases){assert.equal(phase.state.standalone,true);assert.equal(phase.state.offline,true);assert.deepEqual(phase.external,[]);assert.deepEqual(phase.build,evidence.build);}
const archives={},hashes={};
for(const name of ['before','answered','saved','after-restart']){
  const bytes=await readFile(join(folder,name+'.brainpack'));
  archives[name]=await parseStateBackup(bytes.toString('utf8'));
  hashes[name]=createHash('sha256').update(bytes).digest('hex');
}
const {before,answered,saved,'after-restart':after}=archives;
const dialogue=s=>s.settings.find(e=>e.key==='ui-v1-dialogue').value;
const turn=dialogue(answered).turns.find(t=>t.id===evidence.answer.id);
assert.deepEqual(JSON.parse(JSON.stringify(turn)),evidence.answer);
assert.match(turn.answer,new RegExp('NUTMEG-'+caseId+'9'));assert.match(turn.answer,/CEDAR-5821/);
assert.ok(turn.refs.length>=2);validateGroundingRefs(answered.notes,turn.refs);
assert.deepEqual(dialogue(saved).turns.find(t=>t.id===turn.id).activity,turn.activity);
assert.equal(saved.notes.find(n=>n.revisions.at(-1).path?.endsWith('QA'+caseId+'-local-result.md')).revisions.at(-1).body,turn.answer);
for(const note of before.notes)assert.deepEqual(saved.notes.find(n=>n.id===note.id),note);
assert.deepEqual(before.runs,saved.runs.filter(e=>before.runs.some(old=>old.key===e.key)));
assert.deepEqual(after.notes,saved.notes);assert.deepEqual(after.runs,saved.runs);
console.log(JSON.stringify({pass:true,scope:'Read-only retained current integration evidence, not fresh browser execution',build:evidence.build,archiveSHA256:hashes},null,2));
