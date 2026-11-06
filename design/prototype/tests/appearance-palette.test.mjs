import test from 'node:test';
import assert from 'node:assert/strict';
import {appearancePaletteStyle,colorContrast,validateAppearancePalette,validateNamedAppearancePalette,validateAppearancePaletteRegistry} from '../src/appearance-palette.ts';

const night={name:'Night garden',canvas:'#101820',text:'#f2f5f7',surface:'#203040',surfaceText:'#f2f5f7',accent:'#76e3c1',accentText:'#102018',muted:'#d1dae1',border:'#506070'};
test('custom palette validates text contrast and projects only fixed CSS variables',()=>{
 assert.ok(colorContrast(night.text,night.canvas)>=4.5);assert.ok(colorContrast(night.surfaceText,night.surface)>=4.5);
 assert.deepEqual(appearancePaletteStyle(night),{'--theme-canvas':'#101820','--theme-text':'#f2f5f7','--theme-surface':'#203040','--theme-surface-text':'#f2f5f7','--theme-accent':'#76e3c1','--theme-accent-text':'#102018','--theme-muted':'#d1dae1','--theme-border':'#506070'});
 assert.equal(validateAppearancePalette(null),null);assert.equal(appearancePaletteStyle(null),undefined);
});
test('palette projection rejects injection-shaped colors and unreadable combinations',()=>{
 assert.throws(()=>appearancePaletteStyle({...night,canvas:'url(https://example.test/x)'}),/color/i);
 assert.throws(()=>validateAppearancePalette({...night,text:'#777777'}),/contrast/i);
 assert.throws(()=>validateAppearancePalette({...night,accentText:'#ffffff',accent:'#eeeeee'}),/contrast/i);
 assert.throws(()=>validateAppearancePalette({...night,other:'#000000'}),/fields/i);
});

test('named palettes are declarative, uniquely named, bounded, and selectable by stable ID',()=>{
 const namedNight={id:'palette-night-garden',...night};
 assert.deepEqual(validateNamedAppearancePalette(namedNight),namedNight);
 assert.deepEqual(validateAppearancePaletteRegistry([namedNight],'palette-night-garden'),{paletteRegistry:[namedNight],activePaletteId:'palette-night-garden'});
 assert.throws(()=>validateNamedAppearancePalette({...namedNight,id:'night'}),/identity/i);
 assert.throws(()=>validateAppearancePaletteRegistry([namedNight,{...namedNight,id:'palette-second',name:' NIGHT GARDEN '}],''),/name/i);
 assert.throws(()=>validateAppearancePaletteRegistry(Array.from({length:13},(_,index)=>({...namedNight,id:`palette-${index}`,name:`Palette ${index}`})),''),/limit/i);
 assert.throws(()=>validateAppearancePaletteRegistry([namedNight],'palette-missing'),/active/i);
 assert.throws(()=>validateNamedAppearancePalette({...namedNight,id:'palette-bad',canvas:'url(https://example.test/x)'}),/color/i);
});
