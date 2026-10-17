"""Render PUBLIC retained fixtures with the verified SAME GGUF template. No inference/server."""
import collections, hashlib, json, pathlib, struct, sys
from jinja2.sandbox import ImmutableSandboxedEnvironment

model, repo, out = map(pathlib.Path, sys.argv[1:4])
manifest = json.loads((repo / 'dist/model-manifest.json').read_text(encoding='utf-8'))
pin = next(m for m in manifest['models'] if m['id'] == '4B')
assert model.stat().st_size == pin['file']['bytes'], 'Reference model size differs'
with model.open('rb') as f:
    assert hashlib.file_digest(f, 'sha256').hexdigest() == pin['file']['sha256'], 'Reference model hash differs'

with model.open('rb') as f:
    def number(fmt):
        size = struct.calcsize('<'+fmt); value = f.read(size)
        if len(value) != size: raise ValueError('Truncated GGUF')
        return struct.unpack('<'+fmt, value)[0]
    def string():
        size = number('Q')
        if size > 64*1024*1024: raise ValueError('Oversized GGUF string')
        value = f.read(size)
        if len(value) != size: raise ValueError('Truncated GGUF string')
        return value.decode('utf-8')
    def value(kind, depth=0):
        if depth > 3: raise ValueError('Nested GGUF array')
        if kind == 8: return string()
        if kind == 9:
            subtype, count = number('I'), number('Q')
            if count > 1000000: raise ValueError('Oversized GGUF array')
            return [value(subtype, depth+1) for _ in range(count)]
        formats = {0:'B',1:'b',2:'H',3:'h',4:'I',5:'i',6:'f',7:'?',10:'Q',11:'q',12:'d'}
        if kind not in formats: raise ValueError('Unknown GGUF type')
        return number(formats[kind])
    assert f.read(4) == b'GGUF'; version = number('I'); assert version == 3
    tensors, entries = number('Q'), number('Q'); assert entries < 16384 and tensors < 100000
    metadata = {}
    for _ in range(entries):
        key = string(); metadata[key] = value(number('I'))
    tensor_types = collections.Counter()
    for _ in range(tensors):
        name, dimensions = string(), number('I'); assert dimensions <= 8
        shape = [number('Q') for _ in range(dimensions)]
        kind, offset = number('I'), number('Q'); tensor_types[kind] += 1

out.mkdir(parents=True, exist_ok=True)
template = metadata['tokenizer.chat_template']
(out/'chat-template.jinja').write_text(template, encoding='utf-8', newline='')
summary = {k:v for k,v in metadata.items() if not isinstance(v,list) and k != 'tokenizer.chat_template'}
summary.update(ggufVersion=version,tensorCount=tensors,tensorTypes=dict(tensor_types),templateSha256=hashlib.sha256(template.encode()).hexdigest(),templateBytes=len(template.encode()),vocabularySize=len(metadata['tokenizer.ggml.tokens']))
(out/'metadata-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
env = ImmutableSandboxedEnvironment(trim_blocks=True,lstrip_blocks=True,extensions=['jinja2.ext.loopcontrols'])
def fail(message): raise ValueError(message)
env.globals['raise_exception'] = fail
tokens = metadata['tokenizer.ggml.tokens']
def token(key): return tokens[metadata[key]] if key in metadata else ''
choices = [('harness-initial-833486c101132c29.json','raw-minimal'),('current-request-routing-probe-3ed5b4802c79ade6.json','old-transform'),('current-request-operations-read-3ed5b4802c79ade6.json','read-tool-operation-read'),('current-request-relative-5ca20e9c35b7cfc8.json','relative-split')]
cases = []
for filename, name in choices:
    report = json.loads((repo/'research/evaluations'/filename).read_text(encoding='utf-8'))
    case = next(r for r in report['results'] if r['id']==name)
    rendered = env.from_string(template).render(messages=case['input'],tools=None,enable_thinking=False,add_generation_prompt=True,bos_token=token('tokenizer.ggml.bos_token_id'),eos_token=token('tokenizer.ggml.eos_token_id'))
    prompt_file = name+'.prompt.txt'; (out/prompt_file).write_text(rendered,encoding='utf-8',newline='')
    cases.append(dict(id=name,messages=case['input'],promptFile=prompt_file,promptSha256=hashlib.sha256(rendered.encode()).hexdigest(),promptBytes=len(rendered.encode()),maxTokens=case.get('maxTokens',report['maxTokens']),webgpuCount=case['count'],webgpuOutput=case['answer'],sourceReport=filename))
(out/'cases.json').write_text(json.dumps(dict(model=pin['id'],revision=pin['revision'],sha256=pin['file']['sha256'],templateArgs=dict(enable_thinking=False,add_generation_prompt=True),renderer='Python3.12/Jinja2 3.1.6 sandbox, trim_blocks/lstrip_blocks true',cases=cases),ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(dict(verifiedModel=pin['file']['sha256'],templateBytes=len(template.encode()),tensorTypes=dict(tensor_types),cases=[dict(id=c['id'],promptBytes=c['promptBytes'],webgpuTokens=c['webgpuCount']['prompt_tokens']) for c in cases])))
