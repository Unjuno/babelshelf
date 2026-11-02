import test from 'node:test';
import assert from 'node:assert/strict';
import {checkAnswerConsistency} from '../src/answer-consistency.ts';

test('an explicitly excluded meeting place is not repeated from a cited note',()=>{
 const question='持っていくものだけ教えてください。集合場所は含めないでください。';
 const evidence=[{quote:'持ち物は青いノートです。集合場所は北口です。'}];
 assert.throws(()=>checkAnswerConsistency(question,'持ち物は青いノートです。集合場所は北口です。',evidence),/excluded detail/i);
 assert.throws(()=>checkAnswerConsistency(question,'青いノートを持っていってください。集合場所は北口です。',evidence),/excluded detail/i);
 assert.throws(()=>checkAnswerConsistency(question,'青いノートを持っていってください。北口で集合します。',evidence),/excluded detail/i);
 assert.doesNotThrow(()=>checkAnswerConsistency(question,'青いノートを持っていってください。',evidence));
});

test('explicitly excluded English meeting locations are checked without blocking allowed facts',()=>{
 const question='List only the supplies to bring. Do not include the meeting location.';
 const evidence=[{quote:'Supplies: a blue notebook. Meeting location: North gate.'}];
 assert.throws(()=>checkAnswerConsistency(question,'Bring a blue notebook. Meeting location: North gate.',evidence),/excluded detail/i);
 assert.throws(()=>checkAnswerConsistency(question,'Bring a blue notebook. Meet at North gate.',evidence),/excluded detail/i);
 assert.doesNotThrow(()=>checkAnswerConsistency(question,'Bring a blue notebook.',evidence));
 assert.doesNotThrow(()=>checkAnswerConsistency('Where is the meeting location?','The meeting location is North gate.',evidence));
});
