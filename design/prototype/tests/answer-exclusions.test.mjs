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

test('generic excluded location details are checked only when the user explicitly excludes them',()=>{
 const english='List only the supplies. Exclude the location.';
 const englishEvidence=[{quote:'Supplies: a blue notebook. Location: North gate.'}];
 assert.throws(()=>checkAnswerConsistency(english,'Bring a blue notebook. Meet at North gate.',englishEvidence),/excluded detail/i);
 assert.throws(()=>checkAnswerConsistency(english,'Bring a blue notebook. Location: North gate.',englishEvidence),/excluded detail/i);
 assert.doesNotThrow(()=>checkAnswerConsistency(english,'Bring a blue notebook.',englishEvidence));
 assert.doesNotThrow(()=>checkAnswerConsistency('Where is the location?','The location is North gate.',englishEvidence));

 const japanese='持ち物だけ教えてください。場所は書かないでください。';
 const japaneseEvidence=[{quote:'持ち物：青いノート。場所：北口。'}];
 assert.throws(()=>checkAnswerConsistency(japanese,'青いノートを持っていってください。北口で集合します。',japaneseEvidence),/excluded detail/i);
 assert.throws(()=>checkAnswerConsistency(japanese,'青いノートを持っていってください。場所は北口です。',japaneseEvidence),/excluded detail/i);
 assert.doesNotThrow(()=>checkAnswerConsistency(japanese,'青いノートを持っていってください。',japaneseEvidence));
 assert.doesNotThrow(()=>checkAnswerConsistency('場所はどこですか？','場所は北口です。',japaneseEvidence));
});

test('negated exclusion wording does not hide a location the user wants included',()=>{
 const evidence=[{quote:'Supplies: a blue notebook. Location: North gate.'}];
 assert.doesNotThrow(()=>checkAnswerConsistency("List the supplies and don't exclude the location.",'Bring a blue notebook and meet at North gate.',evidence));
 assert.doesNotThrow(()=>checkAnswerConsistency('List the supplies and do not omit the location.','Bring a blue notebook and meet at North gate.',evidence));
 assert.doesNotThrow(()=>checkAnswerConsistency('持ち物と場所を教えてください。場所は除外しないでください。','青いノートを持って北口で集合してください。',[{quote:'持ち物：青いノート。場所：北口。'}]));
 assert.doesNotThrow(()=>checkAnswerConsistency('持ち物と場所を教えてください。場所を除外する必要はありません。','青いノートを持って北口で集合してください。',[{quote:'持ち物：青いノート。場所：北口。'}]));
});
