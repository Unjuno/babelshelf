/** Explicit recovery only: never clear storage or change network preferences. */
export async function recoverStartup<Registration>(ports:{getRegistration:()=>Promise<Registration|undefined>;update:(registration:Registration)=>Promise<unknown>;reload:()=>void}){
 const registration=await ports.getRegistration();
 if(!registration)throw Error('App update unavailable');
 await ports.update(registration);
 ports.reload();
}
