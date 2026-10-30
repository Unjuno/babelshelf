import test from 'node:test';
import assert from 'node:assert/strict';
import {checkAnswerConsistency} from '../src/answer-consistency.ts';

test('color questions reject standalone quantities, including polite answers',()=>{
 for(const answer of ['七リットル','七リットルです。','約 7 L','7 liters.'])assert.throws(()=>checkAnswerConsistency('容器は何色ですか？',answer),/does not match/);
 for(const answer of ['青色です。','容器は青色で、水は七リットルです。','記載がありません。'])assert.doesNotThrow(()=>checkAnswerConsistency('容器は何色ですか？',answer));
 assert.doesNotThrow(()=>checkAnswerConsistency('水は何リットルですか？','七リットルです。'));
});
test('explicit meeting-time questions reject unrelated sourced excerpts while allowing stated times and uncertainty',()=>{
 const question='このファイルに書かれた集合時刻を教えて。';
 for(const answer of ['集合場所は図書館。飲料水は17リットル。','17 litres.'])assert.throws(()=>checkAnswerConsistency(question,answer),/does not match/);
 for(const answer of ['集合時刻は午前10時です。','集合時刻は明日の朝です。','集合時刻の記載はありません。','Neither note mentions a set time; no 集合時刻 is stated in either.','The meeting time is 10 am.','集合时间未注明。'])assert.doesNotThrow(()=>checkAnswerConsistency(question,answer));
 assert.doesNotThrow(()=>checkAnswerConsistency('集合時刻が書いてあるか英語で教えて。','The notes do not state a meeting time.'));
 assert.doesNotThrow(()=>checkAnswerConsistency('集合場所はどこ？','図書館です。'));
});

test('direct English quote requests reject an exact but unrelated heading',()=>{
 const question='From this file, quote the sentence that states the water-cache amount?';
 assert.throws(()=>checkAnswerConsistency(question,'# Temporary evaluation fixture'),/does not match/);
 assert.doesNotThrow(()=>checkAnswerConsistency(question,'The local water cache contains exactly 18 litres.'));
 const evidence=[{quote:'# Temporary evaluation fixture\n\nThe local water cache contains exactly 18 litres.'}];
 assert.doesNotThrow(()=>checkAnswerConsistency(question,'The local water cache contains exactly 18 litres.',evidence));
 assert.throws(()=>checkAnswerConsistency(question,'I cannot find the water-cache amount in this file.',evidence),/does not match source/);
 assert.throws(()=>checkAnswerConsistency(question,'# Temporary evaluation fixture',evidence),/does not match/);
});
