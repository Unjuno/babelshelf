// Verify retained PUBLIC CPU/WebGPU observations. This does not run inference.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const folder=path.resolve(process.argv[2]??'research/evaluations/reference-cpu-e3de715');
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
const cases=JSON.parse(fs.readFileSync(path.join(folder,'prompts/cases.json'),'utf8'));
const pins=JSON.parse(fs.readFileSync(path.join(folder,'pins.json'),'utf8'));
const model=JSON.parse(fs.readFileSync('dist/model-manifest.json','utf8')).models.find(m=>m.id==='4B');
assert.equal(cases.sha256,model.file.sha256);assert.equal(cases.revision,model.revision);
assert.equal(pins.model.file.sha256,cases.sha256);
assert.equal(pins.webgpu.revision,'621e20782f208660f4f58283c2ce58430020f243');
assert.equal(pins.webgpu.file.sha256,'00c1a72a962a84fee17000a6b1d18b24d75033e56d59996fc504b7c57cfc6488');
assert.equal(pins.commit,'e3de715222b2667c54a267441159a5729f11155e');
assert.equal(pins.zip.sha256,'cff7eeff19163e6263720618cf98023715b8dac14d0873f5be0918765de323c4');
assert.deepEqual(cases.templateArgs,{enable_thinking:false,add_generation_prompt:true});
const metadata=JSON.parse(fs.readFileSync(path.join(folder,'prompts/metadata-summary.json'),'utf8'));
assert.equal(hash(fs.readFileSync(path.join(folder,'prompts/chat-template.jinja'))),metadata.templateSha256);
const comparisons=[];
for(const item of cases.cases){
  const report=JSON.parse(fs.readFileSync(path.join(folder,'results',item.id+'.result.json'),'utf8'));
  const prompt=fs.readFileSync(path.join(folder,'prompts',item.promptFile));
  assert.equal(report.case,item.id);assert.equal(report.model,model.id);
  assert.equal(prompt.length,item.promptBytes);assert.equal(hash(prompt),item.promptSha256);
  assert.equal(report.promptSha256,item.promptSha256);assert.equal(report.modelSha256,cases.sha256);
  assert.equal(report.modelRevision,cases.revision);assert.equal(report.commit,pins.commit);
  assert.equal(report.release,pins.release);assert.equal(report.zipSha256,pins.zip.sha256);
  assert.equal(report.binarySha256,'b828938be7b025ddba50b0d0d7cd64cf53f260667abd118853538e8e791b29c2');
  assert.equal(report.contextTokens,2048);assert.equal(report.cacheType,'f32');assert.equal(report.threads,4);
  assert.deepEqual(report.templateArgs,cases.templateArgs);assert.equal(report.renderer,cases.renderer);
  assert.deepEqual(report.args,['-m',pins.model.file.name,'-f','prompts/'+item.promptFile,'--no-conversation','--no-display-prompt','--no-escape','--color','off','--offline','--no-context-shift','--temp','0','--repeat-penalty','1','--presence-penalty','0','--frequency-penalty','0','--seed','0','-c','2048','-n',String(item.maxTokens),'-t','4','-tb','4','-ngl','0','-ctk','f32','-ctv','f32']);
  assert.equal(report.exitCode,0);assert.equal(report.signal,null);
  assert.equal(report.maxTokens,item.maxTokens);
  assert.equal(report.referenceStdout,fs.readFileSync(path.join(folder,'results',item.id+'.stdout.txt'),'utf8'));
  const sourceReport=JSON.parse(fs.readFileSync(path.join('research/evaluations',item.sourceReport),'utf8'));
  assert.equal(sourceReport.model,model.id);assert.equal(sourceReport.revision,model.revision);
  assert.equal(sourceReport.runtime,pins.webgpu.revision);assert.equal(sourceReport.contextTokens,2048);
  assert.equal(sourceReport.status,'Completed');
  const retained=sourceReport.results.find(r=>r.id===item.id);
  assert.equal(retained.resetSession,true);
  if(retained.profile!==undefined)assert.equal(retained.profile,'greedy');
  else assert.equal(sourceReport.do_sample,false);
  assert.deepEqual(retained.input,item.messages);assert.equal(retained.answer,item.webgpuOutput);
  assert.deepEqual(retained.count,item.webgpuCount);assert.deepEqual(report.webgpuCount,retained.count);
  assert.equal(item.maxTokens,retained.maxTokens??sourceReport.maxTokens);
  assert.equal(report.webgpuOutput,item.webgpuOutput);
  const tokens=fs.readFileSync(path.join(folder,item.id+'-tokenize.txt'),'utf8');
  const count=Number(tokens.match(/Total number of tokens: (\d+)/)?.[1]);
  assert.equal(count,item.webgpuCount.prompt_tokens);
  // CLI's EOG marker and final newlines are presentation, verified against pinned
  // tools/completion/completion.cpp. Preserve raw stdout; never trim model prose.
  assert.ok(report.referenceStdout.endsWith(' [end of text]\r\n\r\n\r\n'));
  const answer=report.referenceStdout.slice(0,-' [end of text]\r\n\r\n\r\n'.length).replaceAll('\r\n','\n');
  assert.equal(answer,item.webgpuOutput);
  comparisons.push({id:item.id,tokens:count,elapsedMs:report.elapsedMs,sameObservedText:true});
}
console.log(JSON.stringify({scope:'retained observation integrity, not new inference or numerical/model-quality acceptance',comparisons},null,2));
