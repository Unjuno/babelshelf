import {readOriginal,type OriginalAsset} from './original-assets.ts';
import {isOcrImage,type OcrImage} from './ocr-text.ts';
export function imageSizing(width:number,height:number):OcrImage{
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>64000000)throw Error('Image too large · 64 megapixel limit');const scale=Math.min(1,4096/Math.max(width,height),Math.sqrt(8000000/(width*height)));return {width,height,processedWidth:Math.max(1,Math.floor(width*scale)),processedHeight:Math.max(1,Math.floor(height*scale)),frame:0,orientation:'browser-decoded'};
}
export function imageHeader(bytes:Uint8Array,mime:string){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);if(mime==='image/png'&&bytes.length>=24&&bytes.slice(0,8).every((n,i)=>n===[137,80,78,71,13,10,26,10][i]))return imageSizing(view.getUint32(16),view.getUint32(20));
 if(mime==='image/jpeg'&&bytes[0]===255&&bytes[1]===216){let at=2;while(at+3<bytes.length){if(bytes[at++]!==255)throw Error('Invalid JPEG');while(bytes[at]===255)at++;const marker=bytes[at++];if(marker===217||marker===218)break;if(marker===1||marker>=208&&marker<=215)continue;const length=view.getUint16(at);if(length<2||at+length>bytes.length)break;if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)&&length>=7)return imageSizing(view.getUint16(at+5),view.getUint16(at+3));at+=length;}}
 throw Error('Unsupported image · PNG or JPEG required');
}
export async function rasterizeImage(asset:OriginalAsset,signal:AbortSignal){
 if(!isOcrImage(asset))throw Error('Unsupported image · PNG or JPEG required');const bytes=readOriginal(asset);imageHeader(bytes,asset.mime);signal.throwIfAborted();const bitmap=await createImageBitmap(new Blob([bytes.slice().buffer],{type:asset.mime}));
 try{signal.throwIfAborted();const image=imageSizing(bitmap.width,bitmap.height),canvas=document.createElement('canvas');canvas.width=image.processedWidth;canvas.height=image.processedHeight;const context=canvas.getContext('2d');if(!context)throw Error('Image reading unavailable');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Image conversion failed')),'image/png'));signal.throwIfAborted();return {image,bytes:new Uint8Array(await blob.arrayBuffer())};}finally{bitmap.close();}
}
