import {settings} from './app-settings.ts';
import {validateAppearancePaletteRegistry,type NamedAppearancePalette} from './appearance-palette.ts';
import {validateLocalFontRegistry,type LocalFont} from './local-font-contract.ts';

export type AppearancePreferences={schemaVersion:number;theme:string;background:string;glass:string;fontFamily:string;fonts:LocalFont[];paletteRegistry:NamedAppearancePalette[];activePaletteId:string};

export function createAppearancePreferenceDefaults(schemaVersion:number):AppearancePreferences{
 return {schemaVersion,theme:settings.defaults.theme,background:settings.defaults.background,glass:settings.defaults.glass,fontFamily:settings.defaults.fontFamily,fonts:[],paletteRegistry:[],activePaletteId:''};
}

export function validateAppearancePreference(value:AppearancePreferences):void{
 if(!settings.appearance.themes.includes(value.theme)||!settings.appearance.backgrounds.includes(value.background)||!settings.appearance.glass.includes(value.glass))throw Error('Unsupported appearance value');
 const fonts=validateLocalFontRegistry(value.fonts);
 if(typeof value.fontFamily!=='string'||value.fontFamily!=='system'&&!fonts.some(font=>font.id===value.fontFamily))throw Error('Invalid local font registry');
 const validated=validateAppearancePaletteRegistry(value.paletteRegistry,value.activePaletteId);value.paletteRegistry=validated.paletteRegistry;value.activePaletteId=validated.activePaletteId;
}
