// Presentation only. Preserve canonical errors and detailed operation receipts.
export function runtimeStatus(value:string,request=''):string{
 if(needsModelSettings(value))return value.replace(' · Settings','');
 if(/^(?:Invalid (?:calculation candidate|candidate source(?: (?:shape|index|unit))?|candidate quote)|Candidate quote (?:not found|must be unique))$/.test(value))return 'Could not prepare calculation · check values';
 if(/^Invalid model (?:JSON|action)(?: · retry)?$/i.test(value))return /[?？]\s*\S/u.test(request)?'Could not understand · try one request at a time':'Could not understand · try again';
 if(/^(?:Generation time budget reached|Text generation timed out after \d+ seconds?[\s\S]*)$/i.test(value))return 'Text generation timed out · shortened the request or try again';
 if(/^Text token count timed out after \d+ seconds?[\s\S]*$/i.test(value))return 'Model check timed out · reload the model to retry';
 return /^(?:Error:\s*)?(?:GPU disconnected\b|the GPU device was lost\b|GPU device (?:was )?lost\b|DXGI_ERROR_DEVICE_(?:HUNG|REMOVED|RESET)\b)/i.test(value)?'GPU unavailable':value;
}
// Navigation only: neither prepare assets nor retry the retained request.
export function needsModelSettings(value:string){return /^(?:Model not prepared|Model not configured)(?: · Settings)?$/.test(value);}
