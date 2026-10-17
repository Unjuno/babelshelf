// Creation commits once; conversation acknowledgement is a separate outcome.
export function createReviewedFileSaver(){
 let busy=false;
 return {get busy(){return busy;},async save<T>(commit:()=>Promise<T>,acknowledge:(note:T)=>Promise<void>):Promise<{note:T;acknowledgementError?:string}|undefined>{
  if(busy)return;busy=true;
  try{const note=await commit();try{await acknowledge(note);return {note};}catch(e){return {note,acknowledgementError:e instanceof Error?e.message:String(e)};}}
  finally{busy=false;}
 }};
}
