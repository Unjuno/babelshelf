export interface ToolNote {id:string;path:string;version:number;body:string;[key:string]:any}
export interface ToolHost {search(query:string):Promise<any[]>;views():Promise<ToolNote[]>;check():void}
export function validateQuery(args:unknown):string {
 if(!args || typeof args!=='object' || Array.isArray(args) || Object.keys(args).length!==1 || !Object.hasOwn(args,'query'))throw new Error('Invalid tool arguments');
 const query=(args as {query:unknown}).query;
 if(typeof query!=='string'||!query.trim()||query.length>2000)throw new Error('Invalid tool query');
 return query;
}
