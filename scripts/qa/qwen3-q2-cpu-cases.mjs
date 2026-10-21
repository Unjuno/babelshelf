// Independent reference arithmetic for the bounded native Q2_0 CPU probe.
const assert={equal(a,b,message){if(!Object.is(a,b))throw Error(message??JSON.stringify({actual:a,expected:b}));},ok(value,message){if(!value)throw Error(message??'Probe assertion failed');}};
export function runQwen3Q2CpuProbe(api){
assert.equal(api._probe_init(),1,'Official group64 type and CPU dispatch must be registered');
const half=h=>{const sign=h&32768?-1:1,e=h>>10&31,f=h&1023;return sign*(e===0?f*2**-24:e===31?f?NaN:Infinity:(1+f/1024)*2**(e-15));};
const cases=[];const started=performance.now();
for(const n of [64,128,4096,12288])for(const mode of ['all-codes','negative','zero','subnormal']){
 const qwBytes=n/64*18,qaBytes=n/32*34,w=api._malloc(qwBytes),a=api._malloc(qaBytes),out=api._malloc((n+2)*4),dot=api._malloc(12);assert.ok(w&&a&&out&&dot);
 try{const view=new DataView(api.HEAPU8.buffer),scales=mode==='zero'?[0]:mode==='subnormal'?[1,0x3ff,0x400]:mode==='negative'?[0xbc00,0xb800]:[0x3c00,0x3800,0x3400];
  for(let b=0;b<n/64;b++){view.setUint16(w+b*18,scales[b%scales.length],true);for(let j=0;j<16;j++)view.setUint8(w+b*18+2+j,((b+j)*37+0xe4)&255);}
  for(let b=0;b<n/32;b++){view.setUint16(a+b*34,[0x3800,0x3400,0x3c00][b%3],true);for(let j=0;j<32;j++)view.setInt8(a+b*34+2+j,((b*13+j*17)%255)-127);}
  view.setUint32(out,0x12345678,true);view.setUint32(out+(n+1)*4,0x87654321,true);view.setUint32(dot,0x12345678,true);view.setUint32(dot+8,0x87654321,true);
  assert.equal(api._probe_dequant(w,out+4,n),1);assert.equal(api._probe_dot(w,a,dot+4,n),1);
  let expected=0,maxDequantError=0;
  for(let i=0;i<n;i++){const b=Math.floor(i/64),q=(view.getUint8(w+b*18+2+Math.floor(i%64/4))>>(i%4*2)&3)-1,value=q*half(view.getUint16(w+b*18,true)),ab=Math.floor(i/32),activation=half(view.getUint16(a+ab*34,true))*view.getInt8(a+ab*34+2+i%32),actual=view.getFloat32(out+4+i*4,true);assert.ok(Number.isFinite(actual));maxDequantError=Math.max(maxDequantError,Math.abs(actual-value));expected+=value*activation;}
  const actual=view.getFloat32(dot+4,true),dotError=Math.abs(actual-expected),tolerance=Math.max(1e-5,Math.abs(expected)*1e-6);assert.equal(maxDequantError,0);assert.ok(Number.isFinite(actual)&&dotError<=tolerance,JSON.stringify({n,mode,expected,actual,dotError,tolerance}));
  for(const [ptr,value]of [[out,0x12345678],[out+(n+1)*4,0x87654321],[dot,0x12345678],[dot+8,0x87654321]])assert.equal(view.getUint32(ptr,true),value);
  cases.push({n,mode,maxDequantError,expectedDot:expected,actualDot:actual,dotError,tolerance,sentinels:true,passed:true});
 }finally{api._free(w);api._free(a);api._free(out);api._free(dot);}
}
const matrices=[];
for(const k of [64,4096,12288])for(const columns of [1,3]){
 const rows=4,w=api._malloc(k*rows/64*18),a=api._malloc(k*columns*4),out=api._malloc((rows*columns+2)*4);assert.ok(w&&a&&out);
 try{let view=new DataView(api.HEAPU8.buffer);
  for(let b=0;b<k*rows/64;b++){view.setUint16(w+b*18,[0x3800,0x3400,0xbc00][b%3],true);for(let j=0;j<16;j++)view.setUint8(w+b*18+2+j,((b+j)*37+0xe4)&255);}
  for(let i=0;i<k*columns;i++)view.setFloat32(a+i*4,(i%32===0?127:((i*17)%253)-126)*.125,true);
  view.setUint32(out,0x12345678,true);view.setUint32(out+(rows*columns+1)*4,0x87654321,true);
  assert.equal(api._probe_matmul(w,a,out+4,k,rows,columns),1);view=new DataView(api.HEAPU8.buffer);let maxError=0;
  for(let col=0;col<columns;col++)for(let row=0;row<rows;row++){let expected=0;for(let i=0;i<k;i++){const b=Math.floor((row*k+i)/64),q=(view.getUint8(w+b*18+2+Math.floor(i%64/4))>>(i%4*2)&3)-1;expected+=q*half(view.getUint16(w+b*18,true))*view.getFloat32(a+(col*k+i)*4,true);}const actual=view.getFloat32(out+4+(col*rows+row)*4,true),error=Math.abs(actual-expected);assert.ok(Number.isFinite(actual)&&error<=Math.max(1e-4,Math.abs(expected)*1e-6),JSON.stringify({k,row,col,expected,actual,error}));maxError=Math.max(maxError,error);}
  assert.equal(view.getUint32(out,true),0x12345678);assert.equal(view.getUint32(out+(rows*columns+1)*4,true),0x87654321);matrices.push({k,rows,columns,activation:'F32 quantized by actual CPU graph to Q8_0',maxError,sentinels:true,passed:true});
 }finally{api._free(w);api._free(a);api._free(out);}
}
return {cases,matrices,elapsedMs:performance.now()-started,passed:cases.every(c=>c.passed)&&matrices.every(c=>c.passed)};
}
