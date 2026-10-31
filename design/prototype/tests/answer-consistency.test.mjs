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

test('explicit liquid-volume answers cannot contradict the cited amount',()=>{
 const evidence=[{quote:'The saved reserve contains 17 litres of water.'}];
 assert.throws(()=>checkAnswerConsistency('How much water is in the saved reserve?','The reserve contains 18 litres.',evidence),/conflicts with cited quantity/i);
 assert.doesNotThrow(()=>checkAnswerConsistency('How much water is in the saved reserve?','The reserve contains 17 L.',evidence));
 assert.doesNotThrow(()=>checkAnswerConsistency('How much water is in the saved reserve?','The reserve contains 17000 ml.',evidence));
 assert.throws(()=>checkAnswerConsistency('How much water is in the saved reserve?','The reserve contains 18 litres.',[{quote:'The reserve has been prepared for emergencies.'}]),/conflicts with cited quantity/i);
 const japanese=[{quote:'備蓄水は17 Lです。'}];
 assert.throws(()=>checkAnswerConsistency('備蓄水は何リットルですか？','備蓄水は18リットルです。',japanese),/conflicts with cited quantity/i);
 assert.doesNotThrow(()=>checkAnswerConsistency('備蓄水は何リットルですか？','備蓄水は17リットルです。',japanese));
 assert.throws(()=>checkAnswerConsistency('水の備蓄量を教えて。','水は18リットルです。',japanese),/conflicts with cited quantity/i);
 assert.throws(()=>checkAnswerConsistency('How much water is in the saved reserve?','The reserve contains 18 litres.',[{quote:'The reserve contains 17 litres of water, and the fuel can contains 18 litres of fuel.'}]),/conflicts with cited quantity/i);
 assert.doesNotThrow(()=>checkAnswerConsistency('How much water is in the saved reserve?','The reserve contains 17 litres.',[{quote:'The reserve contains 17 litres of water, and the fuel can contains 18 litres of fuel.'}]));
});

test('a question naming one cited note checks its value against that note, not another citation',()=>{
 const evidence=[
  {noteId:'alpha',title:'Alpha reserve',quote:'Alpha reserve contains 17 litres of water.'},
  {noteId:'beta',title:'Beta reserve',quote:'Beta reserve contains 29 litres of water.'},
 ];
 assert.doesNotThrow(()=>checkAnswerConsistency('How much water is in Alpha reserve?','Alpha reserve contains 17 litres.',evidence));
 assert.throws(()=>checkAnswerConsistency('How much water is in Alpha reserve?','Alpha reserve contains 29 litres.',evidence),/conflicts with cited quantity/i);
 // A multi-source comparison remains supported when the request names both
 // notes; this guard does not infer which amount belongs to which prose label.
 assert.doesNotThrow(()=>checkAnswerConsistency('Compare Alpha reserve and Beta reserve water volumes.','17 litres and 29 litres.',evidence));
});

test('direct English quote requests reject an exact but unrelated heading',()=>{
 const question='From this file, quote the sentence that states the water-cache amount?';
 assert.throws(()=>checkAnswerConsistency(question,'# Temporary evaluation fixture'),/does not match/);
 assert.throws(()=>checkAnswerConsistency(question,'The local water cache contains exactly 18 litres.'),/Quoted answer does not match source/i);
 const evidence=[{quote:'# Temporary evaluation fixture\n\nThe local water cache contains exactly 18 litres.'}];
 assert.doesNotThrow(()=>checkAnswerConsistency(question,'The local water cache contains exactly 18 litres.',evidence));
 assert.throws(()=>checkAnswerConsistency(question,'I cannot find the water-cache amount in this file.',evidence),/does not match source/);
 assert.throws(()=>checkAnswerConsistency(question,'# Temporary evaluation fixture',evidence),/does not match/);
});

test('Japanese verbatim quote requests keep the answer in the relevant original sentence',()=>{
 const question='このメモから「水の備蓄量」について原文を一文そのまま引用して。';
 const evidence=[{quote:'# 防災メモ\n\n水の備蓄量は17リットルです。\n集合場所は緑川公園です。'}];
 assert.doesNotThrow(()=>checkAnswerConsistency(question,'水の備蓄量は17リットルです。',evidence));
 assert.throws(()=>checkAnswerConsistency(question,'水の備蓄量は17リットルです。'),/Quoted answer does not match source/i);
 assert.throws(()=>checkAnswerConsistency(question,'集合場所は緑川公園です。',evidence),/Quoted answer does not match question/i);
 assert.throws(()=>checkAnswerConsistency(question,'水の備蓄量は17 Lです。',evidence),/Quoted answer does not match source/i);
});

test('answers cannot add a location ranking absent from cited excerpts',()=>{
 const question='保存した二つのメモを読み、集合場所と飲料水の量を比較し、新しいノートに保存してください。';
 const evidence=[
  {quote:'集合場所は青葉図書館の東入口です。飲料水は17リットルあります。'},
  {quote:'集合場所は緑川公園の西入口です。飲料水は9リットルあります。'}
 ];
 const unsupported='集合場所は青葉図書館の東入口で、飲料水は17リットルです。集合場所は緑川公園の西入口で、飲料水は9リットルです。青葉図書館の方が近いため、飲料水も17リットルの方が多いです。';
 assert.throws(()=>checkAnswerConsistency(question,unsupported,evidence),/location (?:comparison|evidence)/i);
 assert.doesNotThrow(()=>checkAnswerConsistency(question,'二つのメモは集合場所が異なり、水量は17リットルと9リットルです。',evidence));
 assert.doesNotThrow(()=>checkAnswerConsistency(question,'どちらが近いかは、引用したメモには距離の情報がなく判断できません。',evidence));
 assert.doesNotThrow(()=>checkAnswerConsistency(question,'青葉図書館の方が緑川公園より近いと原文に書かれています。',[{quote:'青葉図書館の方が緑川公園より近いと記載されています。'}]));
 assert.doesNotThrow(()=>checkAnswerConsistency(question,'青葉図書館の方が近いです。',[{quote:'青葉図書館まで2 km、緑川公園まで5 kmです。'}]));
 assert.throws(()=>checkAnswerConsistency(question,'Aoba Library is closer.',[{quote:'The trip takes 17 minutes to Aoba Library and 9 minutes to Midorikawa Park.'}]),/location (?:comparison|evidence)/i);
 assert.throws(()=>checkAnswerConsistency('Compare the saved locations Aoba Library and Midorikawa Park.','Aoba Library is closer than Midorikawa Park.',[{quote:'Office C is 2 km from home; Park D is 5 km from home.'}]),/location (?:comparison|evidence)/i);
 assert.throws(()=>checkAnswerConsistency('Compare the saved locations Aoba Library and Midorikawa Park.','Aoba Library is closer than Midorikawa Park.',[{quote:'Aoba Library is 2 km away.'},{quote:'Office C is 5 km away.'}]),/location (?:comparison|evidence)/i);
 assert.doesNotThrow(()=>checkAnswerConsistency('Compare the saved locations Aoba Library and Midorikawa Park.','Aoba Library is closer than Midorikawa Park.',[{quote:'Aoba Library is 2 km from home and Midorikawa Park is 5 km from home.'}]));
 assert.throws(()=>checkAnswerConsistency('Compare the saved locations Aoba Library and Midorikawa Park.','Aoba Library is closer than Midorikawa Park.',[{quote:'Aoba Library is 5 km from home and Midorikawa Park is 2 km from home.'}]),/location (?:comparison|evidence)/i);
 assert.throws(()=>checkAnswerConsistency('Compare the saved locations Aoba Park and Library.','Aoba Park is closer than Library.',[{quote:'Park is 2 km away and Library is 5 km away.'}]),/location (?:comparison|evidence)/i);
 assert.throws(()=>checkAnswerConsistency('Compare the saved locations New Aoba Park and Library.','New Aoba Park is closer than Library.',[{quote:'Aoba Park is 2 km away and Library is 5 km away.'}]),/location (?:comparison|evidence)/i);
 assert.throws(()=>checkAnswerConsistency('Compare the saved locations New Aoba Park and Library.','New Aoba Park is closer than Library.',[{quote:'Aoba Park is closer than Library.'}]),/location (?:comparison|evidence)/i);
 assert.throws(()=>checkAnswerConsistency('Compare the saved locations Aoba Park and Library.','Aoba Park is closer than Library.',[{quote:'Park is closer than Library.'}]),/location (?:comparison|evidence)/i);
 assert.throws(()=>checkAnswerConsistency('Compare the saved locations Park and The Park.','The Park is closer than Library.',[{quote:'Park is closer than Library.'}]),/location (?:comparison|evidence)/i);
 assert.doesNotThrow(()=>checkAnswerConsistency('Compare the saved locations Park and The Park.','The Park is closer than Library.',[{quote:'The Park is closer than Library.'}]));
 assert.throws(()=>checkAnswerConsistency('Compare the saved locations Aoba Library and Midorikawa Park.','Aoba Library is closer than Midorikawa Park.',[{quote:'Aoba Library is 2 km from home and Midorikawa Park is 5 km from home.'},{quote:'Aoba Library is 5 km from home and Midorikawa Park is 2 km from home.'}]),/conflicting location evidence/i);
 assert.throws(()=>checkAnswerConsistency('Compare the saved locations Aoba Library and Midorikawa Park.','Aoba Library is closer than Midorikawa Park.',[{quote:'Aoba Library is closer than Midorikawa Park.'},{quote:'Midorikawa Park is closer than Aoba Library.'}]),/conflicting location evidence/i);
 assert.doesNotThrow(()=>checkAnswerConsistency('二つの場所を比較してください。','青葉図書館の方が緑川公園より近いです。',[{quote:'青葉図書館まで2 km、緑川公園まで5 kmです。'}]));
 assert.throws(()=>checkAnswerConsistency('二つの場所を比較してください。','青葉図書館の方が緑川公園より近いです。',[{quote:'青葉図書館まで5 km、緑川公園まで2 kmです。'}]),/location (?:comparison|evidence)/i);
 assert.doesNotThrow(()=>checkAnswerConsistency('二つの場所を比較してください。','緑川公園より青葉図書館の方が近いです。',[{quote:'青葉図書館まで2 km、緑川公園まで5 kmです。'}]));
 assert.throws(()=>checkAnswerConsistency('二つの場所を比較してください。','緑川公園より青葉図書館の方が近いです。',[{quote:'青葉図書館まで5 km、緑川公園まで2 kmです。'}]),/location (?:comparison|evidence)/i);
 assert.throws(()=>checkAnswerConsistency('Compare the saved locations Aoba Library and Midorikawa Park.','Aoba Library is not closer than Midorikawa Park.',[{quote:'Aoba Library is 2 km from home and Midorikawa Park is 5 km from home.'}]),/location (?:comparison|evidence)/i);
 assert.doesNotThrow(()=>checkAnswerConsistency('Compare the saved locations Aoba Library and Midorikawa Park.','Aoba Library is not closer than Midorikawa Park.',[{quote:'Aoba Library is 5 km from home and Midorikawa Park is 2 km from home.'}]));
 assert.doesNotThrow(()=>checkAnswerConsistency('Compare the saved locations Aoba Library and Midorikawa Park.','Aoba Library is not closer than Midorikawa Park.',[{quote:'Aoba Library is not closer than Midorikawa Park.'}]));
 assert.throws(()=>checkAnswerConsistency('二つの場所を比較してください。','青葉図書館の方が緑川公園より近くありません。',[{quote:'青葉図書館まで2 km、緑川公園まで5 kmです。'}]),/location (?:comparison|evidence)/i);
 assert.doesNotThrow(()=>checkAnswerConsistency('二つの場所を比較してください。','青葉図書館の方が緑川公園より近くありません。',[{quote:'青葉図書館まで5 km、緑川公園まで2 kmです。'}]));
 assert.doesNotThrow(()=>checkAnswerConsistency('二つの場所を比較してください。','青葉図書館の方が緑川公園より近くありません。',[{quote:'青葉図書館の方が緑川公園より近くありません。'}]));
 assert.throws(()=>checkAnswerConsistency('二つの場所を比較してください。','緑川公園より青葉図書館の方が近くありません。',[{quote:'青葉図書館まで2 km、緑川公園まで5 kmです。'}]),/location (?:comparison|evidence)/i);
 assert.doesNotThrow(()=>checkAnswerConsistency('二つの場所を比較してください。','緑川公園より青葉図書館の方が近くありません。',[{quote:'青葉図書館まで5 km、緑川公園まで2 kmです。'}]));
 assert.doesNotThrow(()=>checkAnswerConsistency('「より近い」とはどういう意味ですか？','「より近い」とは、距離が短いことを表します。',[]));
});
