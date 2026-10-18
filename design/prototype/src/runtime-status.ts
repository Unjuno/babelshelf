// Presentation only. Preserve canonical errors and detailed operation receipts.
export function runtimeStatus(value:string):string{
 return /^(?:Error:\s*)?(?:the GPU device was lost\b|GPU device (?:was )?lost\b|DXGI_ERROR_DEVICE_(?:HUNG|REMOVED|RESET)\b)/i.test(value)?'GPU unavailable':value;
}
