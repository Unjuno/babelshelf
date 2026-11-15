import {emptyDialogue,validateDialogue,type Dialogue} from './conversation.ts';
export type ConversationSession={id:string;name:string;createdAt:string;updatedAt:string};
export type ConversationSessions={schema:1;activeId:string;sessions:ConversationSession[]};
export const CONVERSATION_SESSIONS_KEY='ui-v1-conversation-sessions';
export const CONVERSATION_DIALOGUE_PREFIX='ui-v1-conversation:';
export const conversationDialogueKey=(id:string)=>CONVERSATION_DIALOGUE_PREFIX+encodeURIComponent(id);
export const isConversationDialogueKey=(key:string)=>key.startsWith(CONVERSATION_DIALOGUE_PREFIX);
export function conversationDialogueEntries(settings:{key:string;value:any}[]):{sessionId:string|null;key:string;dialogue:Dialogue}[]{
 const indexEntry=settings.find(item=>item.key===CONVERSATION_SESSIONS_KEY),activeEntry=settings.find(item=>item.key==='ui-v1-dialogue');
 if(!indexEntry){if(settings.some(item=>isConversationDialogueKey(item.key)))throw Error('Unindexed conversation session data');return activeEntry?[{sessionId:null,key:activeEntry.key,dialogue:validateDialogue(activeEntry.value)}]:[];}
 const sessions=validateConversationSessions(indexEntry.value),byKey=new Map(settings.filter(item=>isConversationDialogueKey(item.key)).map(item=>[item.key,item]));
 const result=sessions.sessions.map(session=>{
  const key=session.id===sessions.activeId?'ui-v1-dialogue':conversationDialogueKey(session.id),entry=key==='ui-v1-dialogue'?activeEntry:byKey.get(key);
  if(!entry)throw Error(session.id===sessions.activeId?'Active conversation data unavailable':'Conversation session data unavailable');
  if(key!=='ui-v1-dialogue')byKey.delete(key);
  return {sessionId:session.id,key,dialogue:entry?validateDialogue(entry.value):emptyDialogue()};
 });
 if(byKey.size)throw Error('Unindexed conversation session data');
 const turnIds=new Set<string>();
 for(const item of result)for(const turn of item.dialogue.turns){if(turnIds.has(turn.id))throw Error('Conversation turn identity is duplicated');turnIds.add(turn.id);}
 return result;
}

const isRecord=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
const exact=(value:Record<string,unknown>,keys:string[])=>Object.keys(value).sort().join(',')===[...keys].sort().join(',');
function validTime(value:unknown){return typeof value==='string'&&value.length<=64&&Number.isFinite(Date.parse(value));}
function validName(value:unknown):value is string{return typeof value==='string'&&value.trim().length>0&&value.trim().length<=80;}
function validId(value:unknown):value is string{return typeof value==='string'&&value.length>0&&value.length<=128;}

export function validateConversationSessions(value:unknown):ConversationSessions{
 if(!isRecord(value)||!exact(value,['schema','activeId','sessions'])||value.schema!==1||!validId(value.activeId)||!Array.isArray(value.sessions)||value.sessions.length<1||value.sessions.length>1000)throw Error('Conversation session index invalid');
 const ids=new Set<string>();
 for(const item of value.sessions){
  if(!isRecord(item)||!exact(item,['id','name','createdAt','updatedAt'])||!validId(item.id)||ids.has(item.id)||!validName(item.name)||!validTime(item.createdAt)||!validTime(item.updatedAt))throw Error('Conversation session invalid');
  ids.add(item.id);
 }
 if(!ids.has(value.activeId))throw Error('Active conversation unavailable');
 return value as unknown as ConversationSessions;
}
function copy(value:ConversationSessions){return structuredClone(validateConversationSessions(value));}
function requireSession(value:ConversationSessions,id:string){const found=value.sessions.find(session=>session.id===id);if(!found)throw Error('Conversation unavailable');return found;}

export function createConversationSession(value:ConversationSessions,id:string,now:string):ConversationSessions{
 const sessions=copy(value);if(!validId(id)||sessions.sessions.some(session=>session.id===id))throw Error('Conversation identity already exists');if(!validTime(now))throw Error('Conversation timestamp invalid');
 sessions.sessions.push({id,name:'New conversation',createdAt:now,updatedAt:now});sessions.activeId=id;return validateConversationSessions(sessions);
}
export function switchConversationSession(value:ConversationSessions,id:string):ConversationSessions{
 const sessions=copy(value);requireSession(sessions,id);sessions.activeId=id;return validateConversationSessions(sessions);
}
export function renameConversationSession(value:ConversationSessions,id:string,name:string,now:string):ConversationSessions{
 const sessions=copy(value),target=requireSession(sessions,id);if(!validName(name))throw Error('Conversation name required · use 1–80 characters');if(!validTime(now))throw Error('Conversation timestamp invalid');target.name=name.trim();target.updatedAt=now;return validateConversationSessions(sessions);
}
export function deleteConversationSession(value:ConversationSessions,id:string,replacementId?:string):ConversationSessions{
 const sessions=copy(value);requireSession(sessions,id);if(sessions.sessions.length===1)throw Error('Create another conversation before deleting the last conversation');
 if(id===sessions.activeId){if(!replacementId||replacementId===id)throw Error('Choose a replacement conversation before deleting the active conversation');requireSession(sessions,replacementId);sessions.activeId=replacementId;}
 else if(replacementId!==undefined)requireSession(sessions,replacementId);
 sessions.sessions=sessions.sessions.filter(session=>session.id!==id);return validateConversationSessions(sessions);
}
