// Actual ggml backend graph checks; scalar JS reference is independent of WGSL.
const half=h=>{const e=h>>10&31,m=h&1023;return (h&32768?-1:1)*(e===0?m*2**-24:(1+m/1024)*2**(e-15));};
export async function runBackendCases(api, fixtures, progress=async()=>{}) {
 const result={cases:[],registryCounts:[],passed:false};
 const call=(name,args,types)=>api.ccall(name,'number',types??args.map(()=> 'number'),args,{async:true});
 const alloc=api.cwrap('probe_alloc','bigint',['number']),free=api.cwrap('probe_free',null,['bigint']);
 const owned=[];
 const put=data=>{const ptr=alloc(data.byteLength);if(!ptr)throw Error('QA WASM allocation failed');owned.push(ptr);api.HEAPU8.set(new Uint8Array(data.buffer,data.byteOffset,data.byteLength),Number(ptr));return ptr;};
 const clear=()=>{for(const ptr of owned)free(ptr);owned.length=0;};
 try {
 if(await call('probe_init',[])!==1)throw Error('Actual WebGPU backend initialization failed');
 for(const fixture of fixtures)for(const offset of [0,1]) {
  const {k}=fixture,rowBytes=k/64*18,rows=5,parentRows=rows+offset+1,source=new Uint8Array(fixture.weights),weights=new Uint8Array(parentRows*2*rowBytes);
  if(source.length!==rows*rowBytes)throw Error('Unexpected five-row fixture geometry');
  for(let r=0;r<parentRows*2;r++)weights.set(source.subarray(r%rows*rowBytes,(r%rows+1)*rowBytes),r*rowBytes);
  const view=new DataView(weights.buffer),value=(batch,row,i)=>{const block=((batch*parentRows+offset+row)*k+i)/64|0;return half(view.getUint16(block*18,true))*((weights[block*18+2+(i%64>>2)]>>(i%4*2)&3)-1);};
  await progress({fixture:fixture.name,k,offset,phase:'get_rows'});
  const indices=new Int32Array([4,0,2]),rowOut=new Float32Array(k*3+2).fill(12345);
  let w=put(weights),x=put(indices),y=put(rowOut),status=await call('probe_rows',[w,x,y+4n,k,rows,3,offset],['bigint','bigint','bigint','number','number','number','number']);
  if(status!==1)throw Error('GET_ROWS backend status '+status);
  let values=new Float32Array(api.HEAPU8.buffer,Number(y),rowOut.length).slice(),maxError=0;
  if(values[0]!==12345||values.at(-1)!==12345)throw Error('GET_ROWS host output sentinel changed');
  for(let r=0;r<3;r++)for(let i=0;i<k;i++)maxError=Math.max(maxError,Math.abs(values[1+r*k+i]-value(0,indices[r],i)));
  if(maxError!==0)throw Error('GET_ROWS reference mismatch '+maxError);
  result.cases.push({op:'GET_ROWS',fixture:fixture.name,k,offset,rows,count:3,maxError,hostOutputSentinels:true,passed:true});clear();
  for(const columns of [1,3,5,33])for(const batches of [1,2]) {
   await progress({fixture:fixture.name,k,offset,phase:'mul_mat',columns,batches});
   const input=Float32Array.from({length:k*(columns+1)*batches},(_,i)=>(i*17%253-126)*.125),out=new Float32Array(rows*columns*batches+2).fill(12345);
   w=put(weights);x=put(input);y=put(out);
   status=await call('probe_matmul',[w,x,y+4n,k,rows,columns,batches,offset],['bigint','bigint','bigint','number','number','number','number','number']);
   if(status!==1)throw Error('MUL_MAT backend status '+status);
   values=new Float32Array(api.HEAPU8.buffer,Number(y),out.length).slice();maxError=0;
   if(values[0]!==12345||values.at(-1)!==12345)throw Error('MUL_MAT host output sentinel changed');
   for(let batch=0;batch<batches;batch++)for(let col=0;col<columns;col++)for(let row=0;row<rows;row++) {
    let expected=0;for(let i=0;i<k;i++)expected+=value(batch,row,i)*input[(batch*(columns+1)+col+1)*k+i];
    const actual=values[1+(batch*columns+col)*rows+row],error=Math.abs(actual-expected);
    if(!Number.isFinite(actual)||error>Math.max(1e-3,Math.abs(expected)*1e-5))throw Error(JSON.stringify({op:'MUL_MAT',fixture:fixture.name,k,offset,columns,batches,batch,col,row,expected,actual,error}));
    maxError=Math.max(maxError,error);
   }
   result.cases.push({op:'MUL_MAT',fixture:fixture.name,k,offset,rows,columns,batches,maxError,hostOutputSentinels:true,passed:true});clear();
  }
 }
 // Exercise repeated registry lookup after real work, without hiding failures.
 for(let i=0;i<2;i++)result.registryCounts.push(await call('probe_registry_count',[]));
 await call('probe_shutdown',[]);
 result.reinitialized=await call('probe_init',[])===1;
 if(result.reinitialized){
  const fixture=fixtures[0],k=fixture.k,rowBytes=k/64*18,weights=new Uint8Array(7*rowBytes),source=new Uint8Array(fixture.weights);
  for(let r=0;r<7;r++)weights.set(source.subarray(r%5*rowBytes,(r%5+1)*rowBytes),r*rowBytes);
  const w=put(weights),ids=put(new Int32Array([0])),out=put(new Float32Array(k+2).fill(12345));
  const status=await call('probe_rows',[w,ids,out+4n,k,5,1,1],['bigint','bigint','bigint','number','number','number','number']);
  const values=new Float32Array(api.HEAPU8.buffer,Number(out),k+2).slice(),view=new DataView(weights.buffer);let maxError=0;
  for(let i=0;i<k;i++){const block=(k+i)/64|0,expected=half(view.getUint16(block*18,true))*((weights[block*18+2+(i%64>>2)]>>(i%4*2)&3)-1);maxError=Math.max(maxError,Math.abs(values[1+i]-expected));}
  result.reinitializedReadback={k,status,maxError,hostOutputSentinels:values[0]===12345&&values.at(-1)===12345,passed:status===1&&maxError===0&&values[0]===12345&&values.at(-1)===12345};clear();
 }
 result.passed=result.cases.length===fixtures.length*18&&result.cases.every(c=>c.passed)&&result.registryCounts.every(n=>n===1)&&result.reinitialized&&result.reinitializedReadback?.passed===true;
 }catch(error){result.error=error.stack??error.message;}
 finally{clear();try{await call('probe_shutdown',[]);}catch(error){result.cleanupError=error.message;result.passed=false;}}
 return result;
}
