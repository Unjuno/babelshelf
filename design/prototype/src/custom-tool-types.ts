import type {ToolInputSchema} from './tools/tool-input.ts';
export type {ToolInputField as CustomInputField,ToolInputSchema as CustomInputSchema} from './tools/tool-input.ts';
type CustomInputSchema=ToolInputSchema;
export const CUSTOM_TOOL_CAPABILITIES=Object.freeze(['memory.search','memory.list','memory.read','math.calculate','time.now'] as const);
export type CustomToolCapability=typeof CUSTOM_TOOL_CAPABILITIES[number];
export function isCustomToolCapability(value:unknown):value is CustomToolCapability{return typeof value==='string'&&(CUSTOM_TOOL_CAPABILITIES as readonly string[]).includes(value);}
export type CustomToolPackage={id:string;version:number;title:string;entry:string;capabilities:readonly CustomToolCapability[];inputSchema:CustomInputSchema;skill:string;skillSource:string;code:string;sha256:string};
export type CustomToolSourceRecord={path:string;body:string};
