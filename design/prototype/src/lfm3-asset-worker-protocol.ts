export type Lfm3AssetFailureCode='storage-quota-exceeded';
export type Lfm3AssetFailureFields={code?:Lfm3AssetFailureCode;downloadedBytes?:number;downloadedAssets?:number};
export type Lfm3AssetFailureMessage={id:number;error:string}&Lfm3AssetFailureFields;

const messageLimit=2000;
const validCounter=(value:unknown,maximum=Number.MAX_SAFE_INTEGER):value is number=>Number.isSafeInteger(value)&&Number(value)>=0&&Number(value)<=maximum;

/** Keep the worker boundary limited to safe, useful preparation diagnostics. */
export function serializeLfm3AssetFailure(id:number,error:unknown):Lfm3AssetFailureMessage{
 const value=error&&typeof error==='object'?error as {message?:unknown;code?:unknown;downloadedBytes?:unknown;downloadedAssets?:unknown}:{};
 const raw=typeof value.message==='string'?value.message:'Model asset preparation failed';
 return {id,error:raw.slice(0,messageLimit),...(value.code==='storage-quota-exceeded'?{code:value.code}:{}),...(validCounter(value.downloadedBytes)?{downloadedBytes:value.downloadedBytes}:{}),...(validCounter(value.downloadedAssets,64)?{downloadedAssets:value.downloadedAssets}:{})};
}

/** Reconstruct only allowlisted fields received from the dedicated worker. */
export function deserializeLfm3AssetFailure(data:unknown):Error{
 const value=data&&typeof data==='object'?data as Record<string,unknown>:{};
 const error=new Error(typeof value.error==='string'&&value.error?value.error.slice(0,messageLimit):'Model asset preparation failed');
 if(value.code==='storage-quota-exceeded')Object.assign(error,{code:value.code});
 if(validCounter(value.downloadedBytes))Object.assign(error,{downloadedBytes:value.downloadedBytes});
 if(validCounter(value.downloadedAssets,64))Object.assign(error,{downloadedAssets:value.downloadedAssets});
 return error;
}
