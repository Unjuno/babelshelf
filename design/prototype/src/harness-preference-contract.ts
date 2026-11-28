import type {ReplyStyle} from './reply-style-contract.ts';
import {MAX_AGENT_RESULT_CHARS,MAX_CONFIGURED_AGENT_TOOLS} from './agent-limits.ts';
import {builtinToolIds as SAFE_AGENT_TOOL_IDS} from './tools/builtin-tools.ts';
import {MAX_TURN_GENERATION_MS,MAX_TURN_GENERATION_TOKENS} from './turn-inference-budget.ts';
import {REPLY_STYLES} from './reply-style-contract.ts';
import {validateHarnessGuidance} from './harness-guidance.ts';

export type HarnessProfile={id:string;label:string;enabledTools:string[];maxToolCalls:number|null;maxResultChars:number;maxGenerationTokens?:number|null;maxGenerationMs?:number|null};
export function createHarnessPreferenceDefaults(schemaVersion:number){
 return {schemaVersion,replyStyle:'balanced' as ReplyStyle,userGuidance:'',activeProfileId:'standard',profiles:[
  {id:'standard',label:'Standard',enabledTools:['memory.search','memory.list','memory.read','memory.sources','math.calculate','time.now'],maxToolCalls:null,maxResultChars:MAX_AGENT_RESULT_CHARS,maxGenerationTokens:8192,maxGenerationMs:300_000},
  {id:'source-first',label:'Source first',enabledTools:['memory.search','memory.list','memory.read','memory.sources'],maxToolCalls:null,maxResultChars:6000,maxGenerationTokens:8192,maxGenerationMs:300_000},
  {id:'conversation',label:'Conversation',enabledTools:[],maxToolCalls:0,maxResultChars:MAX_AGENT_RESULT_CHARS,maxGenerationTokens:8192,maxGenerationMs:300_000},
 ] as HarnessProfile[]};
}
export type HarnessPreferenceRecord=ReturnType<typeof createHarnessPreferenceDefaults>;
export type HarnessPreferences=Omit<HarnessPreferenceRecord,'schemaVersion'>;

export function validateHarnessPreferenceRecord(value:unknown):HarnessPreferenceRecord{
 const harness=value as HarnessPreferenceRecord;
 if(typeof harness.replyStyle!=='string'||!REPLY_STYLES.includes(harness.replyStyle)||!validateHarnessGuidance(harness.userGuidance)||typeof harness.activeProfileId!=='string'||!Array.isArray(harness.profiles)||!harness.profiles.length||harness.profiles.length>12)throw Error('Invalid harness profile registry or user guidance');
 const ids=new Set<string>();
 for(const profile of harness.profiles){
  if(!profile||typeof profile!=='object'||Array.isArray(profile)||Object.keys(profile).sort().join('|')!=='enabledTools|id|label|maxGenerationMs|maxGenerationTokens|maxResultChars|maxToolCalls')throw Error('Invalid harness profile fields');
  if(typeof profile.id!=='string'||!/^[a-z][a-z0-9-]{0,31}$/.test(profile.id)||ids.has(profile.id)||typeof profile.label!=='string'||!profile.label.trim()||profile.label.length>48)throw Error('Invalid harness profile identity');
  ids.add(profile.id);
  if(!Array.isArray(profile.enabledTools)||profile.enabledTools.length>MAX_CONFIGURED_AGENT_TOOLS||new Set(profile.enabledTools).size!==profile.enabledTools.length||profile.enabledTools.some(id=>typeof id!=='string'||(!SAFE_AGENT_TOOL_IDS.includes(id as typeof SAFE_AGENT_TOOL_IDS[number])&&!/^user\.[a-z][a-z0-9-]{0,47}$/.test(id))))throw Error('Unsupported harness tool');
  if(profile.maxToolCalls!==null&&(!Number.isSafeInteger(profile.maxToolCalls)||profile.maxToolCalls<0)||!Number.isSafeInteger(profile.maxResultChars)||profile.maxResultChars<256||profile.maxResultChars>MAX_AGENT_RESULT_CHARS||profile.maxGenerationTokens===undefined||profile.maxGenerationTokens!==null&&(!Number.isSafeInteger(profile.maxGenerationTokens)||typeof profile.maxGenerationTokens!=='number'||profile.maxGenerationTokens<256||profile.maxGenerationTokens>MAX_TURN_GENERATION_TOKENS)||profile.maxGenerationMs===undefined||profile.maxGenerationMs!==null&&(!Number.isSafeInteger(profile.maxGenerationMs)||typeof profile.maxGenerationMs!=='number'||profile.maxGenerationMs<1_000||profile.maxGenerationMs>MAX_TURN_GENERATION_MS)||!profile.enabledTools.length&&profile.maxToolCalls!==0)throw Error('Harness profile budget is invalid');
 }
 if(!ids.has(harness.activeProfileId))throw Error('Active harness profile is unavailable');
 return harness;
}
