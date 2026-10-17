// Only the newest requested preview can change the presented sheet.
export class PreviewSelection{
 private epoch=0;
 cancel(){this.epoch++;}
 async load<T>(read:()=>Promise<T>):Promise<T|undefined>{const ticket=++this.epoch;try{const value=await read();return ticket===this.epoch?value:undefined;}catch(e){if(ticket===this.epoch)throw e;return undefined;}}
}
