/** Verification is deliberately read-only. Keep its missing-runtime message
 * aligned with the user's current download setting so checking cannot appear
 * to instruct an already-online user to turn Online on again. */
export function semanticSearchOperationMessage(cause:unknown,downloads:boolean){
 const message=cause instanceof Error?cause.message:'Search operation failed';
 if(message.startsWith('Runtime not prepared'))
  return downloads?'Search runtime is not prepared · choose Prepare runtime.':'Search runtime is not prepared · turn Online on in Connection settings before preparing it.';
 return message;
}
