import test from 'node:test';import assert from 'node:assert/strict';
const paths=await import('../src/memory-paths.ts').catch(()=>({}));
test('five folder levels allow files, sixth folder is rejected',()=>{assert.equal(paths.folderPath('a/b/c/d','e'),'a/b/c/d/e');assert.equal(paths.filePath('a/b/c/d/e','記録'),'a/b/c/d/e/記録.md');assert.throws(()=>paths.folderPath('a/b/c/d/e','f'),/5/);assert.throws(()=>paths.validateFilePath('a/b/c/d/e/f/note.md'),/5/);});
test('file creation needs a name only and refuses traversal or conflicting paths',()=>{assert.equal(paths.filePath('work','Meeting.md'),'work/Meeting.md');assert.equal(paths.filePath('','Meeting'),'Meeting.md');for(const name of ['../bad','a/b','a\\b',''])assert.throws(()=>paths.filePath('work',name));assert.throws(()=>paths.filePath('work','meeting',['WORK/MEETING.md']));assert.throws(()=>paths.folderPath('work','a',['work/a']));});

test('Memory has immutable system folders and creates only inside them',()=>{
 assert.deepEqual(paths.SYSTEM_FOLDERS,['Inbox','Notes','Schedule','Notifications','Attachments','Tools','Settings']);
 assert.equal(Object.isFrozen(paths.SYSTEM_FOLDERS),true);
 assert.equal(paths.memoryFilePath('Inbox','記録'),'Inbox/記録.md');
 assert.equal(paths.memoryFolderPath('Notes','Projects'),'Notes/Projects');
 assert.throws(()=>paths.memoryFolderPath('','Other'),/system folder/i);
 assert.throws(()=>paths.memoryFilePath('','Inbox'),/system folder/i);
 assert.throws(()=>paths.validateMemoryFilePath('Other/note.md'),/system folder/i);
 assert.throws(()=>paths.validateMemoryFilePath('Notes/a/b/c/d/e/n.md'),/5/);
 for(const root of paths.SYSTEM_FOLDERS)assert.throws(()=>paths.assertMutableFolder(root),/protected/i);
 assert.throws(()=>paths.assertMutableFolder('inbox'),/protected/i);
 assert.doesNotThrow(()=>paths.assertMutableFolder('Notes/Projects'));
});

test('user tool packages may store one exact executable entry while all other code extensions remain Markdown',()=>{
 assert.equal(paths.memoryFolderPath('Tools','user.lookup'),'Tools/user.lookup');
 assert.equal(paths.memoryFilePath('Tools/user.lookup','SKILL.md'),'Tools/user.lookup/SKILL.md');
 assert.equal(paths.memoryFilePath('Tools/user.lookup','tool.js'),'Tools/user.lookup/tool.js');
 assert.equal(paths.validateMemoryFilePath('Tools/user.lookup/tool.js'),'Tools/user.lookup/tool.js');
 assert.equal(paths.memoryFilePath('Notes','tool.js'),'Notes/tool.js.md');
 for(const path of ['Tools/user.lookup/other.js','Tools/user.lookup/deep/tool.js','Notes/user.lookup/tool.js','Tools/user.lookup/tool.ts'])assert.throws(()=>paths.validateMemoryFilePath(path),/\.md|tool\.js/);
});

test('captured note names keep the complete first sentence when it fits',()=>{
 const body='The blue lantern meeting is on 19 November at 14:40 in Cedar Room.\nExtra details';
 assert.equal(paths.suggestedNoteName(body),'The blue lantern meeting is on 19 November at 14-40 in Cedar Room');
 assert.equal(paths.suggestedNoteName('Long '.repeat(30)).length<=80,true);
});
