import test from 'node:test';import assert from 'node:assert/strict';
import {prepareOriginal,originalNote,originalKey} from '../src/original-assets.ts';
import {makeTranscript,transcriptNote,validateTranscript} from '../src/speech-transcript.ts';
import {transcriptCitationRange} from '../src/voice-input.ts';
import {makeStateBackup,parseStateBackup} from '../src/backup-state.ts';
test('mapped video transcript preserves timing through backup and converts citation offsets',async()=>{
 const asset=await prepareOriginal(new File(['schema fixture'],'delayed.webm',{type:'video/webm'}));
 const timing={schema:1,processor:'mediabunny-1.61.6',timebase:'container-presentation',trackId:2,startUs:5001000,endUs:13121000};
 const t=makeTranscript(asset,8120,{text:'First. Second.',chunks:[{text:'First.',timestamp:[0,2]},{text:'Second.',timestamp:[3,8.12]}]},'en',timing);
 assert.deepEqual(t.containerTiming,timing);const range=transcriptCitationRange(t,t.text,1,7,14);
 assert.equal(range.startMs,8001);assert.equal(range.endMs,13121);assert.equal(range.seekable,true);
 const n=transcriptNote('mapped-test',asset,t),pack=await makeStateBackup({notes:[originalNote(asset),n],settings:[],runs:[{key:originalKey(asset.id),value:asset}]});
 assert.deepEqual((await parseStateBackup(JSON.stringify(pack))).notes[1].transcription.containerTiming,timing);
 for(const patch of [{endUs:5000000},{trackId:0},{processor:'unverified'},{startUs:-1}])assert.throws(()=>validateTranscript({...t,containerTiming:{...timing,...patch}},asset),/timing/i);
 assert.equal(transcriptCitationRange(t,'Edited',2,0,6).seekable,undefined);
 const legacy=makeTranscript(asset,8120,{text:'First.',chunks:[{text:'First.',timestamp:[0,2]}]});assert.equal(transcriptCitationRange(legacy,legacy.text,1,0,6).seekable,undefined);
});
