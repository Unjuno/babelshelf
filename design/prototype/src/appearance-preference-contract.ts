import {settings} from './app-settings.ts';
import {validateAppearancePaletteRegistry,type NamedAppearancePalette} from './appearance-palette.ts';
import type {LocalFont} from './local-font-contract.ts';

export type AppearancePreferences={schemaVersion:number;theme:string;background:string;glass:string;fontFamily:string;fonts:LocalFont[];paletteRegistry:NamedAppearancePalette[];activePaletteId:string};

export function createAppearancePreferenceDefaults(schemaVersion:number):AppearancePreferences{
 return {schemaVersion,theme:settings.defaults.theme,background:settings.defaults.background,glass:settings.defaults.glass,fontFamily:settings.defaults.fontFamily,fonts:[],paletteRegistry:[],activePaletteId:''};
}

export function validateAppearancePreference(value:AppearancePreferences):void{
 if(!settings.appearance.themes.includes(value.theme)||!settings.appearance.backgrounds.includes(value.background)||!settings.appearance.glass.includes(value.glass))throw Error('Unsupported appearance value');
 if(typeof value.fontFamily!=='string'||value.fontFamily!=='system'&&!value.fonts?.some(font=>font.id===value.fontFamily)||!Array.isArray(value.fonts)||value.fonts.length>32||new Set(value.fonts.map(font=>font?.id)).size!==value.fonts.length||value.fonts.some(font=>!font||!/^font-[a-f0-9]{64}$/.test(font.id)||typeof font.label!=='string'||font.label.length>128||!['woff2','woff','ttf','otf'].includes(font.format)||!Number.isSafeInteger(font.bytes)||font.bytes<1||font.bytes>20*1024*1024||font.sha256!==font.id.slice(5)))throw Error('Invalid local font registry');
 const validated=validateAppearancePaletteRegistry(value.paletteRegistry,value.activePaletteId);value.paletteRegistry=validated.paletteRegistry;value.activePaletteId=validated.activePaletteId;
}
