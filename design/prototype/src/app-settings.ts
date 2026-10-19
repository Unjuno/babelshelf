import defaults from './app-settings.json' with { type: 'json' };

type Settings = typeof defaults;
const roots = ['Inbox','Notes','Schedule','Notifications','Attachments','Tools','Settings'];
const allowedText = ['4B','2B','9B','smollm2-360m-instruct','qwen25-05b-instruct','lfm25-350m-qad-q4-0','lfm25-230m-qad-q4-0'];
const allowedDecision = ['', 'd1-omni-600M','d1-3B'];

function record(value:unknown):asserts value is Record<string,unknown> {
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid settings object');
}
function keys(value:unknown,expected:string[]){record(value);if(Object.keys(value).sort().join('|')!==[...expected].sort().join('|'))throw Error('Unknown or missing settings fields');}
function list(value:unknown,allowed:string[]){if(!Array.isArray(value)||value.length!==allowed.length||!allowed.every((x,i)=>value[i]===x))throw Error('Unsupported settings values');}
function freeze<T>(value:T):T {if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}

// A configuration is data. It cannot add providers, executable tools or permissions.
export function validateSettings(value:unknown):Settings {
 keys(value,['schemaVersion','models','defaults','appearance','media','storage','harness']);
 const c=value as Settings;
 if(c.schemaVersion!==6)throw Error('Unsupported settings version');
 keys(c.models,['text','decision','transcription','ocr','vision']);
 for(const [role,allowed] of [['text',allowedText],['decision',allowedDecision]] as const){
  const options=c.models[role];
  if(!Array.isArray(options)||options.length!==allowed.length)throw Error('Invalid model registry');
  options.forEach((item,i)=>{keys(item,['value','label']);if(item.value!==allowed[i]||typeof item.label!=='string'||!item.label.trim())throw Error('Unsupported model');});
 }
 const speechIDs=['whisper-tiny','whisper-base'];
 if(!Array.isArray(c.models.transcription)||c.models.transcription.length!==2)throw Error('Invalid transcription registry');
 c.models.transcription.forEach((item,i)=>{keys(item,['value','label','parameters','language']);if(item.value!==speechIDs[i]||typeof item.label!=='string'||!item.label.trim()||item.parameters!==[39000000,74000000][i]||item.language!=='Multilingual')throw Error('Unsupported transcription model');});
 if(!Array.isArray(c.models.ocr)||c.models.ocr.length!==1||c.models.ocr[0].value!=='tesseract-7'||c.models.ocr[0].label!=='Tesseract 7')throw Error('Unsupported image reader');keys(c.models.ocr[0],['value','label']);
 if(!Array.isArray(c.models.vision)||c.models.vision.length!==1||c.models.vision[0].value!=='lfm25-vl-450m-q4f16'||c.models.vision[0].label!=='LFM2.5-VL · 450M · Vision')throw Error('Unsupported vision model');keys(c.models.vision[0],['value','label']);
 keys(c.defaults,['ocrModel','visionModel','textModel','decisionModel','transcriptionModel','downloads','theme','background','glass']);
 if(c.defaults.ocrModel!=='')throw Error('Invalid image reader default');
 if(c.defaults.visionModel!==''&&!c.models.vision.some(m=>m.value===c.defaults.visionModel))throw Error('Invalid vision default');
 if(c.defaults.transcriptionModel!==''&&!speechIDs.includes(c.defaults.transcriptionModel))throw Error('Invalid transcription default');
 if(!allowedText.includes(c.defaults.textModel)||!allowedDecision.includes(c.defaults.decisionModel)||c.defaults.downloads!==false)throw Error('Invalid model/network defaults');
 keys(c.appearance,['themes','backgrounds','glass']);
 list(c.appearance.themes,['system','light','dark']);list(c.appearance.backgrounds,['paper','sage','sand']);list(c.appearance.glass,['clear','frosted']);
 if(!c.appearance.themes.includes(c.defaults.theme)||!c.appearance.backgrounds.includes(c.defaults.background)||!c.appearance.glass.includes(c.defaults.glass))throw Error('Invalid appearance default');
 keys(c.media,['maxTextBytes','capabilities']);
 if(!Number.isSafeInteger(c.media.maxTextBytes)||c.media.maxTextBytes<1||c.media.maxTextBytes>1048576)throw Error('Invalid text read budget');
 const capabilities=['image.read','image.describe','audio.transcribe','video.read'];
 if(!Array.isArray(c.media.capabilities)||c.media.capabilities.length!==capabilities.length)throw Error('Invalid media registry');
 c.media.capabilities.forEach((item,i)=>{keys(item,['id','label']);if(item.id!==capabilities[i]||typeof item.label!=='string'||!item.label.trim())throw Error('Unsupported capability');});
 keys(c.storage,['protectedRoots','maxFolderDepth','captureFolder']);list(c.storage.protectedRoots,roots);
 if(c.storage.maxFolderDepth!==5||c.storage.captureFolder!=='Inbox')throw Error('Invalid storage policy');
 keys(c.harness,['localOnly','implicitDownloads','automaticOverwrite','automaticDelete','clarifyAmbiguousTarget','preserveOriginals','requireSourceRevision']);
 for(const [key,expected] of Object.entries({localOnly:true,implicitDownloads:false,automaticOverwrite:false,automaticDelete:false,clarifyAmbiguousTarget:true,preserveOriginals:true,requireSourceRevision:true})){
  if(c.harness[key as keyof typeof c.harness]!==expected)throw Error('Unsafe harness policy');
 }
 return freeze(structuredClone(c));
}

export const settings=validateSettings(defaults);

// Availability comes from installed runtime evidence, never a settings label.
export function mediaStatus(id:string,readiness:Readonly<Record<string,boolean>>={}) {
 if(!settings.media.capabilities.some(c=>c.id===id))return 'Unsupported';
 return readiness[id]===true?'Ready':'Not prepared';
}
