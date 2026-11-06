export type AppearancePalette={name:string;canvas:string;text:string;surface:string;surfaceText:string;accent:string;accentText:string;muted:string;border:string};
export type NamedAppearancePalette=AppearancePalette&{id:string};
const paletteKeys=['accent','accentText','border','canvas','muted','name','surface','surfaceText','text'];
function luminance(hex:string){const channels=[1,3,5].map(index=>parseInt(hex.slice(index,index+2),16)/255).map(channel=>channel<=.04045?channel/12.92:((channel+.055)/1.055)**2.4);return .2126*channels[0]+.7152*channels[1]+.0722*channels[2];}
export function colorContrast(first:string,second:string){const a=luminance(first),b=luminance(second);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);}
export function validateAppearancePalette(value:unknown):AppearancePalette|null{
 if(value===null)return null;
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid custom palette');
 const palette=value as Record<string,unknown>;
 if(Object.keys(palette).sort().join('|')!==paletteKeys.join('|'))throw Error('Invalid custom palette fields');
 if(typeof palette.name!=='string'||!palette.name.trim()||palette.name.trim().length>40||/[\u0000-\u001f<>]/.test(palette.name))throw Error('Invalid palette name');
 for(const key of paletteKeys.filter(key=>key!=='name'))if(typeof palette[key]!=='string'||!/^#[0-9a-fA-F]{6}$/.test(palette[key] as string))throw Error('Invalid palette color');
 const colors=palette as unknown as AppearancePalette;
 for(const [foreground,background,label] of [[colors.text,colors.canvas,'Text'],[colors.text,colors.surface,'Surface text'],[colors.surfaceText,colors.surface,'Surface text'],[colors.accent,colors.canvas,'Accent'],[colors.accent,colors.surface,'Surface accent'],[colors.accentText,colors.accent,'Accent text'],[colors.muted,colors.canvas,'Muted text'],[colors.muted,colors.surface,'Muted surface text']] as const){
  if(colorContrast(foreground,background)<4.5)throw Error(`${label} contrast must be at least 4.5:1`);
 }
 return {...colors,name:colors.name.trim()};
}
export function validateNamedAppearancePalette(value:unknown):NamedAppearancePalette{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid named palette');
 const {id,...palette}=value as Record<string,unknown>;
 if(typeof id!=='string'||!/^palette-[a-z0-9][a-z0-9-]{0,39}$/.test(id))throw Error('Invalid palette identity');
 return {id,...validateAppearancePalette(palette)!};
}
export function validateAppearancePaletteRegistry(value:unknown,activePaletteId:unknown){
 if(!Array.isArray(value)||value.length>12)throw Error('Palette registry exceeds the 12 palette limit');
 const paletteRegistry=value.map(validateNamedAppearancePalette),ids=new Set(paletteRegistry.map(palette=>palette.id)),names=new Set(paletteRegistry.map(palette=>palette.name.normalize('NFKC').trim().toLowerCase()));
 if(ids.size!==paletteRegistry.length)throw Error('Duplicate palette identity');
 if(names.size!==paletteRegistry.length)throw Error('Duplicate palette name');
 if(typeof activePaletteId!=='string'||activePaletteId!==''&&!ids.has(activePaletteId))throw Error('Active palette is unavailable');
 return {paletteRegistry,activePaletteId};
}
export function appearancePaletteStyle(value:AppearancePalette|NamedAppearancePalette|null):import('react').CSSProperties|undefined{
 const palette=validateAppearancePalette(value===null?null:'id' in value?Object.fromEntries(Object.entries(value).filter(([key])=>key!=='id')):value);if(!palette)return undefined;
 return {'--theme-canvas':palette.canvas,'--theme-text':palette.text,'--theme-surface':palette.surface,'--theme-surface-text':palette.surfaceText,'--theme-accent':palette.accent,'--theme-accent-text':palette.accentText,'--theme-muted':palette.muted,'--theme-border':palette.border} as unknown as import('react').CSSProperties;
}
