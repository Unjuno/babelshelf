function readVarint(bytes:Uint8Array,offset:number,end:number):{value:number;next:number}|null{
 let value=0,multiplier=1;
 for(let i=0;i<8&&offset<end;i++){
  const byte=bytes[offset++];value+=(byte&0x7f)*multiplier;
  if((byte&0x80)===0)return Number.isSafeInteger(value)?{value,next:offset}:null;
  multiplier*=128;
 }
 return null;
}

/** Walk protobuf fields without decoding tensor payloads. ONNX stores each
 * NodeProto.op_type in field 4; this is used only to select a provider known
 * to support an operator, never as validation of the graph itself. */
function scanFields(bytes:Uint8Array,start:number,end:number,match:(field:number,wire:number,payloadStart:number,payloadEnd:number)=>boolean):boolean{
 let offset=start;
 while(offset<end){
  const tag=readVarint(bytes,offset,end);if(!tag||tag.value===0)return false;offset=tag.next;
  const field=Math.floor(tag.value/8),wire=tag.value&7;if(!field)return false;
  let payloadStart=offset,payloadEnd=offset;
  if(wire===0){const value=readVarint(bytes,offset,end);if(!value)return false;offset=value.next;}
  else if(wire===1){if(offset+8>end)return false;offset+=8;}
  else if(wire===2){const length=readVarint(bytes,offset,end);if(!length||length.value>end-length.next)return false;payloadStart=length.next;payloadEnd=payloadStart+length.value;offset=payloadEnd;}
  else if(wire===5){if(offset+4>end)return false;offset+=4;}
  else return false;
  if(match(field,wire,payloadStart,payloadEnd))return true;
 }
 return false;
}

function operatorEquals(bytes:Uint8Array,start:number,end:number,operator:string){
 if(end-start!==operator.length)return false;
 for(let i=0;i<operator.length;i++)if(bytes[start+i]!==operator.charCodeAt(i))return false;
 return true;
}

function nodeHasOperator(bytes:Uint8Array,start:number,end:number,operator:string){
 return scanFields(bytes,start,end,(field,wire,payloadStart,payloadEnd)=>field===4&&wire===2&&operatorEquals(bytes,payloadStart,payloadEnd,operator));
}

function graphHasOperator(bytes:Uint8Array,start:number,end:number,operator:string){
 return scanFields(bytes,start,end,(field,wire,payloadStart,payloadEnd)=>field===1&&wire===2&&nodeHasOperator(bytes,payloadStart,payloadEnd,operator));
}

export function onnxGraphHasOperator(bytes:Uint8Array,operator:string){
 if(!operator||!bytes.length)return false;
 return scanFields(bytes,0,bytes.length,(field,wire,payloadStart,payloadEnd)=>field===7&&wire===2&&graphHasOperator(bytes,payloadStart,payloadEnd,operator));
}
