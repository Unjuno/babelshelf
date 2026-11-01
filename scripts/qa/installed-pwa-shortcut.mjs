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

function isHistoricalQaProfile(profileDir,{tempDirectory,documentsCodex}){
 if(!absolutePath(profileDir))return false;
 try{
  if(absolutePath(tempDirectory)){
   const api=win32.isAbsolute(tempDirectory)?win32:{resolve};
   const root=canonicalPath(tempDirectory,tempDirectory),candidate=canonicalPath(profileDir,tempDirectory),relative=api.relative(root,candidate);
   const first=relative.split(/[\\/]/,1)[0];
   // Match only the known legacy QA naming scheme. A broad `babelshelf-*`
   // prefix could also match a user's unrelated temporary Chrome profile.
   if(relative&&relative!=='.'&&!relative.startsWith('..')&&!api.isAbsolute(relative)&&/^BabelShelf-lfm230-[0-9a-f]{32}$/i.test(first))return true;
  }
  if(absolutePath(documentsCodex)){
   const api=win32.isAbsolute(documentsCodex)?win32:{resolve};
   const root=canonicalPath(documentsCodex,documentsCodex),candidate=canonicalPath(profileDir,documentsCodex),relative=api.relative(root,candidate);
   return /^pwa-installed-unit\d+[a-z]?$/i.test(relative);
  }
 }catch{}
 return false;
}

export async function removeOwnedInstalledPwaShortcut(profileDir,{platform=process.platform,run=execFileSync,remove=unlink,stat=lstat,tempDirectory=tmpdir(),documentsCodex=process.env.USERPROFILE?win32.join(process.env.USERPROFILE,'Documents','Codex'):undefined}={}){
 if(platform!=='win32')return {removed:0,reason:'not-windows'};
 if(!absolutePath(profileDir))throw Error('Installed PWA profile path must be absolute');
 const script='$start=Join-Path ([Environment]::GetFolderPath("StartMenu")) "Programs";$roots=@([Environment]::GetFolderPath("Desktop"))+@(Get-ChildItem -LiteralPath $start -Directory -ErrorAction SilentlyContinue | Where-Object {$_.Name -match "^(Chrome|Chromium)"} | Select-Object -ExpandProperty FullName);$shell=New-Object -ComObject WScript.Shell;$items=@($roots | Where-Object {Test-Path -LiteralPath $_} | ForEach-Object {Get-ChildItem -LiteralPath $_ -File -ErrorAction SilentlyContinue} | Where-Object {$_.Extension -eq ".lnk" -and $_.BaseName -match "^(BabelShelf|Memory)"} | ForEach-Object {$s=$shell.CreateShortcut($_.FullName);[pscustomobject]@{path64=[Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($_.FullName));target64=[Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($s.TargetPath));arguments64=[Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($s.Arguments))}});ConvertTo-Json -InputObject $items -Compress';
 const output=run('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{encoding:'utf8',windowsHide:true});
 const entries=JSON.parse(String(output).replace(/^\uFEFF/,''));
 if(!Array.isArray(entries))throw Error('Invalid desktop shortcut inventory');
 for(const entry of entries)for(const field of ['path','target','arguments'])if(typeof entry?.[`${field}64`]==='string')entry[field]=Buffer.from(entry[`${field}64`],'base64').toString('utf16le');
 let removed=0;
 for(const entry of entries){
  const owned=belongsToInstalledPwaProfile(entry,profileDir);
  const match=typeof entry?.arguments==='string'?entry.arguments.match(/(?:^|\s)--user-data-dir=(?:"([^"]+)"|(\S+))/i):null;
  const candidate=match?.[1]??match?.[2];
  // An interrupted QA process can leave both its isolated profile and its OS
  // link behind. The UUID-scoped Temp path identifies the QA-owned link; remove
  // only the .lnk and preserve the profile (and any data it contains).
  const managedTemp=!owned&&/\\chrome_proxy\.exe$/i.test(entry?.target??'')&&isManagedTemporaryProfile(candidate,tempDirectory);
  // Older BabelShelf QA runs used product-prefixed Temp profiles and numbered
  // pwa-installed-unit fixtures. Their Start Menu links outlived the run.
  // Remove only those links; do not touch the referenced profile or its data.
  const historical=!owned&&!managedTemp&&/\\chrome_proxy\.exe$/i.test(entry?.target??'')&&isHistoricalQaProfile(candidate,{tempDirectory,documentsCodex});
  if(!owned&&!managedTemp&&!historical)continue;
  const info=await stat(entry.path);
  if(!info.isFile()||info.isSymbolicLink())throw Error('Refusing to remove a non-file shortcut');
  await remove(entry.path);removed++;
 }
 return {removed};
}
