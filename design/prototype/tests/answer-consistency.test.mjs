import test from 'node:test';
import assert from 'node:assert/strict';
import {checkAnswerConsistency} from '../src/answer-consistency.ts';

test('color questions reject standalone quantities, including polite answers',()=>{
 for(const answer of ['七リットル','七リットルです。','約 7 L','7 liters.'])assert.throws(()=>checkAnswerConsistency('容器は何色ですか？',answer),/does not match/);
 for(const answer of ['青色です。','容器は青色で、水は七リットルです。','記載がありません。'])assert.doesNotThrow(()=>checkAnswerConsistency('容器は何色ですか？',answer));
 assert.doesNotThrow(()=>checkAnswerConsistency('水は何リットルですか？','七リットルです。'));
});
