// Actual GPU dispatch/reference cases shared by Node and the sidebar browser.
const half=h=>{const e=h>>10&31,m=h&1023;return (h&32768?-1:1)*(e===0?m*2**-24:(1+m/1024)*2**(e-15));};
export function q2SyntheticFixtures(){
 const fixtures=[];
 for(const k of [64,128,4096,12288,14336]){
  const weights=new Uint8Array(5*k/64*18),view=new DataView(weights.buffer),scales=[0x3800,0x3400,0xbc00,0x0001,0];
  for(let b=0;b<5*k/64;b++){view.setUint16(b*18,scales[b%scales.length],true);for(let j=0;j<16;j++)weights[b*18+2+j]=(b*17+j*37+0xe4)&255;}
  fixtures.push({name:'controlled',k,weights});
 }
 return fixtures;
}
export async function runQ2GpuCases(device,pipelines,fixtures,onProgress=async()=>{}){
 const cases=[];
 async function dispatch(pipeline,weights,input,params,length,groups){
  const owned=[];try{
   const make=(data,usage)=>{const buffer=device.createBuffer({size:Math.ceil(data.byteLength/4)*4,usage,mappedAtCreation:true});new Uint8Array(buffer.getMappedRange()).set(new Uint8Array(data.buffer,data.byteOffset,data.byteLength));buffer.unmap();owned.push(buffer);return buffer;};
   const sentinel=12345,initial=new Float32Array(length+2).fill(sentinel),w=make(weights,GPUBufferUsage.STORAGE),x=make(input,GPUBufferUsage.STORAGE),y=make(initial,GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC),p=make(params,GPUBufferUsage.UNIFORM);
   const read=device.createBuffer({size:initial.byteLength,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});owned.push(read);
   device.pushErrorScope('validation');const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[w,x,y,p].map((buffer,binding)=>({binding,resource:{buffer}}))});const encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(...groups);pass.end();encoder.copyBufferToBuffer(y,0,read,0,initial.byteLength);device.queue.submit([encoder.finish()]);const error=await device.popErrorScope();if(error)throw Error(error.message);
   await read.mapAsync(GPUMapMode.READ);const values=new Float32Array(read.getMappedRange()).slice();read.unmap();if(values[0]!==sentinel||values.at(-1)!==sentinel)throw Error('Output sentinel changed');return values.subarray(1,-1);
  }finally{for(const buffer of owned)buffer.destroy();}
 }
 for(const fixture of fixtures){
  await onProgress(fixture);
  const {k,weights}=fixture,rows=5,view=new DataView(weights.buffer);
  const value=(row,i)=>{const b=Math.floor((row*k+i)/64);return half(view.getUint16(b*18,true))*((weights[b*18+2+Math.floor(i%64/4)]>>(i%4*2)&3)-1);};
  const indices=new Int32Array([4,0,2]),rowParams=new Uint32Array([0,0,1,k/64,0,0,1,0,0,k,0,0,k,3,1,1,1,1,0,0]);
  const actualRows=await dispatch(pipelines.rows,weights,indices,rowParams,3*k,[3,1,1]);let rowError=0;
  for(let row=0;row<3;row++)for(let i=0;i<k;i++)rowError=Math.max(rowError,Math.abs(actualRows[row*k+i]-value(indices[row],i)));if(rowError!==0)throw Error('Q2_0 rows differ from independent reference');
  for(const columns of [1,3]){
  const input=Float32Array.from({length:k*columns},(_,i)=>(i*17%253-126)*.125),params=new Uint32Array([0,0,1,rows,columns,k,k/64,k,0,0,0,0,1,1,1,1]);
  for(const name of [columns===1?'vector1':'vector','tile']){
   const actual=await dispatch(pipelines[name],weights,input,params,rows*columns,name.startsWith('vector')?[Math.ceil(rows/4),1,1]:[1,1,1]);let maxError=0;
   for(let col=0;col<columns;col++)for(let row=0;row<rows;row++){let expected=0;for(let i=0;i<k;i++)expected+=value(row,i)*input[col*k+i];const error=Math.abs(actual[col*rows+row]-expected);if(!Number.isFinite(actual[col*rows+row])||error>Math.max(1e-3,Math.abs(expected)*1e-5))throw Error(JSON.stringify({name,k,col,row,expected,actual:actual[col*rows+row],error}));maxError=Math.max(maxError,error);}
   cases.push({name,fixture:fixture.name,originalRows:fixture.originalRows??null,k,rows,columns,maxError,rowError,sentinels:true,passed:true});
  }
  }
 }
 return cases;
}
