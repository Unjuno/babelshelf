import {execFileSync} from 'node:child_process';
import {lstat,unlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {isAbsolute,resolve,win32} from 'node:path';

const absolutePath=value=>typeof value==='string'&&(isAbsolute(value)||win32.isAbsolute(value));
function canonicalPath(value,reference){
 const api=win32.isAbsolute(reference)?win32:{resolve};
 return api.resolve(value).replace(/[\\/]+$/,'').toLowerCase();
}

export function belongsToInstalledPwaProfile(entry,profileDir){
 if(!entry||typeof entry!=='object'||typeof entry.path!=='string'||typeof entry.target!=='string'||typeof entry.arguments!=='string'||!absolutePath(profileDir))return false;
 if(!/\\chrome_proxy\.exe$/i.test(entry.target))return false;
 const match=entry.arguments.match(/(?:^|\s)--user-data-dir=(?:"([^"]+)"|(\S+))/i);
 if(!match)return false;
 try{return canonicalPath(match[1]??match[2],profileDir)===canonicalPath(profileDir,profileDir);}catch{return false;}
}

function isManagedTemporaryProfile(profileDir,tempDirectory){
 if(!absolutePath(profileDir)||!absolutePath(tempDirectory))return false;
 const api=win32.isAbsolute(tempDirectory)?win32:{resolve};
 const root=canonicalPath(tempDirectory,tempDirectory),candidate=canonicalPath(profileDir,tempDirectory),relative=api.relative(root,candidate);
 if(!relative||relative==='.'||relative.startsWith('..')||api.isAbsolute(relative)||/[\\/]/.test(relative))return false;
 return /^babelshelf-installed-pwa-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}-profile$/i.test(relative);
}

export async function removeOwnedInstalledPwaShortcut(profileDir,{platform=process.platform,run=execFileSync,remove=unlink,stat=lstat,profileExists=async path=>{try{await lstat(path);return true;}catch(error){if(error?.code==='ENOENT')return false;throw error;}},tempDirectory=tmpdir()}={}){
 if(platform!=='win32')return {removed:0,reason:'not-windows'};
 if(!absolutePath(profileDir))throw Error('Installed PWA profile path must be absolute');
 const script='$desktop=[Environment]::GetFolderPath("Desktop");$shell=New-Object -ComObject WScript.Shell;$items=@(Get-ChildItem -LiteralPath $desktop -File -ErrorAction SilentlyContinue | Where-Object {$_.Extension -eq ".lnk" -and $_.BaseName -match "^(BabelShelf|Memory)"} | ForEach-Object {$s=$shell.CreateShortcut($_.FullName);[pscustomobject]@{path=$_.FullName;target=$s.TargetPath;arguments=$s.Arguments}});ConvertTo-Json -InputObject $items -Compress';
 const output=run('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{encoding:'utf8',windowsHide:true});
 const entries=JSON.parse(String(output).replace(/^\uFEFF/,''));
 if(!Array.isArray(entries))throw Error('Invalid desktop shortcut inventory');
 let removed=0;
 for(const entry of entries){
  const owned=belongsToInstalledPwaProfile(entry,profileDir);
  const match=typeof entry?.arguments==='string'?entry.arguments.match(/(?:^|\s)--user-data-dir=(?:"([^"]+)"|(\S+))/i):null;
  const candidate=match?.[1]??match?.[2];
  // A killed QA process can leave a dead desktop link. Reap only links whose
  // target is one of our UUID-named temporary profiles and whose profile is
  // already absent. Never infer ownership from the app title alone.
  const orphan=!owned&&/\\chrome_proxy\.exe$/i.test(entry?.target??'')&&isManagedTemporaryProfile(candidate,tempDirectory)&&!await profileExists(candidate);
  if(!owned&&!orphan)continue;
  const info=await stat(entry.path);
  if(!info.isFile()||info.isSymbolicLink())throw Error('Refusing to remove a non-file shortcut');
  await remove(entry.path);removed++;
 }
 return {removed};
}
