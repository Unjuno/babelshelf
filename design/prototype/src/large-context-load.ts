/** Large LFM3 context windows need an explicit choice before starting a costly load. */
export function requiresLargeContextLoadConfirmation(modelId:string,customModel:boolean,contextTokens:number){
 return modelId.startsWith('lfm3-1.7b-')&&!customModel&&Number.isSafeInteger(contextTokens)&&contextTokens>=65536;
}
