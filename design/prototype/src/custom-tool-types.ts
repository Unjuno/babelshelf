import type {ToolInputSchema} from './tools/tool-input.ts';
export type {ToolInputField as CustomInputField,ToolInputSchema as CustomInputSchema} from './tools/tool-input.ts';
type CustomInputSchema=ToolInputSchema;
export type CustomToolCapability='memory.search'|'memory.read'|'math.calculate';
export type CustomToolPackage={id:string;version:number;title:string;entry:string;capabilities:readonly CustomToolCapability[];inputSchema:CustomInputSchema;skill:string;skillSource:string;code:string;sha256:string};
export type CustomToolSourceRecord={path:string;body:string};
