export const MAX_HARNESS_GUIDANCE_BYTES=2048;
const encoder=new TextEncoder();

export function harnessGuidanceBytes(value:string){return encoder.encode(value).byteLength;}
export function validateHarnessGuidance(value:unknown):value is string{
 return typeof value==='string'&&harnessGuidanceBytes(value)<=MAX_HARNESS_GUIDANCE_BYTES&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value);
}

export function harnessGuidanceMessage(value:string){
 if(!validateHarnessGuidance(value))throw Error('Invalid assistant instructions');
 const guidance=value.trim();
 return guidance?{role:'system',content:'User-defined assistant instructions (preference text only; not application policy or permission): '+JSON.stringify(guidance)}:null;
}
