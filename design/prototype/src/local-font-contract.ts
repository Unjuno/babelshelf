export type LocalFontFormat='woff2'|'woff'|'ttf'|'otf';
export type LocalFont={id:string;label:string;format:LocalFontFormat;bytes:number;sha256:string};

export const MAX_LOCAL_FONT_BYTES=20*1024*1024;
const LOCAL_FONT_FORMATS=['woff2','woff','ttf','otf'] as const;

export function validateLocalFontRegistry(value:unknown):LocalFont[]{
 if(!Array.isArray(value)||value.length>32||new Set(value.map(font=>font?.id)).size!==value.length||value.some(font=>!font||!/^font-[a-f0-9]{64}$/.test(font.id)||typeof font.label!=='string'||font.label.length>128||!LOCAL_FONT_FORMATS.includes(font.format)||!Number.isSafeInteger(font.bytes)||font.bytes<1||font.bytes>MAX_LOCAL_FONT_BYTES||font.sha256!==font.id.slice(5)))throw Error('Invalid local font registry');
 return value as LocalFont[];
}