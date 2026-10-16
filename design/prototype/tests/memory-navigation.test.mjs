import test from 'node:test';
import assert from 'node:assert/strict';
import {memoryBreadcrumbs,memoryFolderEntries,memoryCreationFolder} from '../src/memory-navigation.ts';
test('Home shows user locations and root exposes internal locations only on request',()=>{
 const folders=['Inbox','Notes','Notes/work','Schedule','Notifications','Attachments'];
 assert.deepEqual(memoryFolderEntries('home','',folders).map(e=>e.label),['Inbox','Notes','Files']);
 assert.deepEqual(memoryFolderEntries('root','',folders).map(e=>e.label),['Home','Schedule','Notifications']);
 assert.deepEqual(memoryFolderEntries('folder','Notes',folders).map(e=>e.path),['Notes/work']);
});
test('breadcrumbs navigate ancestors without changing canonical paths or depth',()=>{
 assert.deepEqual(memoryBreadcrumbs('folder','Notes/work').map(c=>[c.label,c.path]),[['Memory',''],['Home',''],['Notes','Notes'],['work','Notes/work']]);
 assert.deepEqual(memoryBreadcrumbs('folder','Attachments').map(c=>c.label),['Memory','Home','Files']);
 assert.deepEqual(memoryBreadcrumbs('folder','Schedule').map(c=>c.label),['Memory','Schedule']);
 assert.equal(memoryCreationFolder('home','','file'),'Inbox');
 assert.equal(memoryCreationFolder('home','','folder'),'Notes');
 assert.equal(memoryCreationFolder('folder','Notes/work','file'),'Notes/work');
});
