// Read-only check of the last answer at its original snapshot, not fresh inference.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {parseStateBackup} from '../../design/prototype/src/backup-state.ts';
import {validateGroundingRefs} from '../../dist/core.js';
const [out,...paths]=process.argv.slice(2);assert.ok(out&&paths.length);
const results=[];
for(const path of paths){
 const bytes=await readFile(path),pack=await parseStateBackup(bytes.toString('utf8'));
 const turn=pack.settings.find(s=>s.key==='ui-v1-dialogue')?.value.turns.at(-1);
 assert.ok(turn?.answer?.trim()&&turn.refs?.length,'Last turn must be a sourced answer');
 const checked=validateGroundingRefs(pack.notes,turn.refs);
 const forged=structuredClone(turn.refs);forged[0].noteId='nonexistent-source-'+crypto.randomUUID();
 assert.equal(validateGroundingRefs(pack.notes,forged).ok,false,'Negative control accepted');
 results.push({path,sha256:createHash('sha256').update(bytes).digest('hex'),turnId:turn.id,refs:turn.refs.length,checked,negativeControlRejected:true});
}
await writeFile(out,JSON.stringify({scope:'Read-only original retained snapshots; no model rerun',pass:results.every(r=>r.checked.ok),results},null,2),{flag:'wx'});
assert.ok(results.every(r=>r.checked.ok),'Invalid retained references; inspect output');console.log(JSON.stringify(results,null,2));
