import {execFileSync} from 'node:child_process';
import {lstat,unlink} from 'node:fs/promises';
import {isAbsolute,resolve} from 'node:path';

export function belongsToInstalledPwaProfile(entry,profileDir){
 if(!entry||typeof entry!=='object'||typeof entry.path!=='string'||typeof entry.target!=='string'||typeof entry.arguments!=='string'||!isAbsolute(profileDir))return false;
 if(!/\\chrome_proxy\.exe$/i.test(entry.target))return false;
 const match=entry.arguments.match(/(?:^|\s)--user-data-dir=(?:"([^"]+)"|(\S+))/i);
 if(!match)return false;
 try{return resolve(match[1]??match[2]).replace(/[\\/]+$/,'').toLowerCase()===resolve(profileDir).replace(/[\\/]+$/,'').toLowerCase();}catch{return false;}
}

export async function removeOwnedInstalledPwaShortcut(profileDir,{platform=process.platform,run=execFileSync,remove=unlink,stat=lstat}={}){
 if(platform!=='win32')return {removed:0,reason:'not-windows'};
 if(!isAbsolute(profileDir))throw Error('Installed PWA profile path must be absolute');
 const script='$desktop=[Environment]::GetFolderPath("Desktop");$shell=New-Object -ComObject WScript.Shell;$items=@(Get-ChildItem -LiteralPath $desktop -Filter "BabelShelf*.lnk" -File -ErrorAction SilentlyContinue | ForEach-Object {$s=$shell.CreateShortcut($_.FullName);[pscustomobject]@{path=$_.FullName;target=$s.TargetPath;arguments=$s.Arguments}});ConvertTo-Json -InputObject $items -Compress';
 const output=run('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{encoding:'utf8',windowsHide:true});
 const entries=JSON.parse(String(output).replace(/^\uFEFF/,''));
 if(!Array.isArray(entries))throw Error('Invalid desktop shortcut inventory');
 let removed=0;
 for(const entry of entries){
  if(!belongsToInstalledPwaProfile(entry,profileDir))continue;
  const info=await stat(entry.path);
  if(!info.isFile()||info.isSymbolicLink())throw Error('Refusing to remove a non-file shortcut');
  await remove(entry.path);removed++;
 }
 return {removed};
}
