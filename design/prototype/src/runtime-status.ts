// Presentation only. Preserve canonical errors and detailed operation receipts.
export function runtimeStatus(value:string):string{
 if(needsModelSettings(value))return value.replace(' · Settings','');
 return /^(?:Error:\s*)?(?:GPU disconnected\b|the GPU device was lost\b|GPU device (?:was )?lost\b|DXGI_ERROR_DEVICE_(?:HUNG|REMOVED|RESET)\b)/i.test(value)?'GPU unavailable':value;
}
// Navigation only: neither prepare assets nor retry the retained request.
export function needsModelSettings(value:string){return /^(?:Model not prepared|Model not configured)(?: · Settings)?$/.test(value);}
