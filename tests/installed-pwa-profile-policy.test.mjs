import test from 'node:test';
import assert from 'node:assert/strict';
import {parseInstalledPwaArguments,shouldRemoveInstalledPwaOutput,shouldRemoveInstalledPwaProfile} from '../scripts/qa/installed-pwa-profile-policy.mjs';

test('installed-PWA profiles are ephemeral by default, including caller-named fresh paths',()=>{
 assert.deepEqual(parseInstalledPwaArguments([]),{profileArg:undefined,outputArg:undefined,retainProfile:false});
 assert.deepEqual(parseInstalledPwaArguments(['C:/temp/fresh-profile','C:/temp/evidence']),{profileArg:'C:/temp/fresh-profile',outputArg:'C:/temp/evidence',retainProfile:false});
 assert.equal(shouldRemoveInstalledPwaProfile({profileWasAbsentBeforeRun:true,retainProfile:false}),true);
});

test('retention is explicit and only applies to a caller-named profile',()=>{
 assert.deepEqual(parseInstalledPwaArguments(['C:/temp/fresh-profile','C:/temp/evidence','--retain-profile']),{profileArg:'C:/temp/fresh-profile',outputArg:'C:/temp/evidence',retainProfile:true});
 assert.throws(()=>parseInstalledPwaArguments(['--retain-profile']),/requires an explicit new profile path/);
 assert.throws(()=>parseInstalledPwaArguments(['C:/temp/profile','--unknown']),/Unknown installed-PWA option/);
 assert.equal(shouldRemoveInstalledPwaProfile({profileWasAbsentBeforeRun:true,retainProfile:true}),false);
 assert.equal(shouldRemoveInstalledPwaProfile({profileWasAbsentBeforeRun:false,retainProfile:false}),false);
});

test('generated installed-PWA evidence is temporary unless the caller names an output path',()=>{
 assert.equal(shouldRemoveInstalledPwaOutput({outputWasGenerated:true}),true);
 assert.equal(shouldRemoveInstalledPwaOutput({outputWasGenerated:false}),false);
});
