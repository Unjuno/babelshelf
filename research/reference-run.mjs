// One-shot CPU reference only. No server, app connection or private data input.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {spawn} from 'node:child_process';
const base=path.resolve(process.argv[2]),id=process.argv[3];if(!/^[a-z0-9-]+$/.test(id??''))throw Error('Public case ID required');
const cases=JSON.parse(fs.readFileSync(path.join(base,'prompts/cases.json'),'utf8')),item=cases.cases.find(c=>c.id===id);if(!item)throw Error('Unknown public case');
const pins=JSON.parse(fs.readFileSync(path.join(base,'pins.json'),'utf8')),binary=path.join(base,'cpu-bin/llama-completion.exe');
const digest=async file=>{const hash=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(file))hash.update(chunk);return hash.digest('hex');};
const model=path.join(base,pins.model.file.name),prompt=path.join(base,'prompts',item.promptFile);
if(cases.sha256!==pins.model.file.sha256||cases.revision!==pins.model.revision||fs.statSync(model).size!==pins.model.file.bytes||await digest(model)!==cases.sha256)throw Error('Reference model does not match rendered fixtures');
if(fs.statSync(prompt).size!==item.promptBytes||await digest(prompt)!==item.promptSha256)throw Error('Rendered prompt changed');
if(await digest(path.join(base,pins.zip.name))!==pins.zip.sha256)throw Error('Reference release archive changed');
if(await digest(binary)!=='b828938be7b025ddba50b0d0d7cd64cf53f260667abd118853538e8e791b29c2')throw Error('Unexpected pinned reference executable');
const args=['-m',pins.model.file.name,'-f','prompts/'+item.promptFile,'--no-conversation','--no-display-prompt','--no-escape','--color','off','--offline','--no-context-shift','--temp','0','--repeat-penalty','1','--presence-penalty','0','--frequency-penalty','0','--seed','0','-c','2048','-n',String(item.maxTokens),'-t','4','-tb','4','-ngl','0','-ctk','f32','-ctv','f32'];
const folder=path.join(base,'results');fs.mkdirSync(folder,{recursive:true});const target=path.join(folder,id);
if(fs.existsSync(target+'.result.json'))throw Error('Reference report already exists; do not overwrite');
const stdout=fs.createWriteStream(target+'.stdout.txt',{flags:'wx'}),stderr=fs.createWriteStream(target+'.stderr.txt',{flags:'wx'}),started=new Date(),child=spawn(binary,args,{cwd:base,shell:false,windowsHide:true,stdio:['ignore','pipe','pipe']});
child.stdout.pipe(stdout);child.stderr.pipe(stderr);console.log(JSON.stringify({case:id,pid:child.pid,startedAt:started.toISOString(),purpose:'same-weight one-shot CPU diagnostic, no app backend'}));
const result=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',(exitCode,signal)=>resolve({exitCode,signal}));});await Promise.all([new Promise(r=>stdout.closed?r():stdout.on('close',r)),new Promise(r=>stderr.closed?r():stderr.on('close',r))]);
const report={schema:1,scope:'native CPU reference, not PWA/device/offline acceptance',case:id,model:cases.model,modelRevision:cases.revision,modelSha256:cases.sha256,release:pins.release,commit:pins.commit,zipSha256:pins.zip.sha256,binarySha256:crypto.createHash('sha256').update(fs.readFileSync(binary)).digest('hex'),args,renderer:cases.renderer,templateArgs:cases.templateArgs,promptSha256:item.promptSha256,promptBytes:item.promptBytes,maxTokens:item.maxTokens,contextTokens:2048,cacheType:'f32',threads:4,startedAt:started.toISOString(),elapsedMs:Date.now()-started,...result,webgpuCount:item.webgpuCount,webgpuOutput:item.webgpuOutput,referenceStdout:fs.readFileSync(target+'.stdout.txt','utf8'),stderrFile:id+'.stderr.txt'};
fs.writeFileSync(target+'.result.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(result.exitCode!==0)process.exitCode=1;
