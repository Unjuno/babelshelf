import type {ReplyStyle} from './reply-style-contract.ts';

export type HarnessProfile={id:string;label:string;enabledTools:string[];maxToolCalls:number|null;maxResultChars:number;maxGenerationTokens?:number|null;maxGenerationMs?:number|null};
export type HarnessPreferences={replyStyle:ReplyStyle;userGuidance:string;activeProfileId:string;profiles:HarnessProfile[]};
