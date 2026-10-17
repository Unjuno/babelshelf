// Bounded local diagnostic data, never model/adapter installation or execution permissions.
export type HarnessFixture={id:string;messages:{role:string;content:string}[];expected?:string|null;json:boolean;reset:boolean;profile?:'greedy'|'bonsai-nonthinking';seed?:number;maxTokens?:number};
export function parseHarnessCases(raw:string):HarnessFixture[]{
 if(new TextEncoder().encode(raw).length>150000)throw Error('Fixture file too large');const value=JSON.parse(raw);
 if(!value||!Array.isArray(value.cases)||!value.cases.length||value.cases.length>30)throw Error('Invalid fixture cases');
 const allowed=['id','messages','expected','json','reset','profile','seed','maxTokens'];
 for(const f of value.cases){if(!f||Object.keys(f).some(k=>!allowed.includes(k))||typeof f.id!=='string'||!f.id||f.id.length>1000||f.expected!==null&&typeof f.expected!=='string'||typeof f.json!=='boolean'||typeof f.reset!=='boolean'||!Array.isArray(f.messages)||!f.messages.length||f.messages.length>20||f.messages.some((m:any)=>!m||!['system','user','assistant'].includes(m.role)||typeof m.content!=='string'||Object.keys(m).some(k=>!['role','content'].includes(k)))||f.profile!==undefined&&!['greedy','bonsai-nonthinking'].includes(f.profile)||f.seed!==undefined&&(!Number.isInteger(f.seed)||f.seed<0||f.seed>4294967295)||f.maxTokens!==undefined&&(!Number.isInteger(f.maxTokens)||f.maxTokens<1||f.maxTokens>512))throw Error('Invalid fixture');}
 return value.cases;
}
