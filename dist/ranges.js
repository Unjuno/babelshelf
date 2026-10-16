export function fileResponse(file,options={}){
 const h=new Headers(options.headers);const range=h.get('Range');let start=0,end=file.size-1,status=200;
 if(range){const m=/^bytes=(\d*)-(\d*)$/.exec(range);if(!m||!m[1]&&!m[2])return new Response(null,{status:416});
  if(!m[1])start=Math.max(0,file.size-Number(m[2]));else start=Number(m[1]);
  if(m[1]&&m[2])end=Math.min(end,Number(m[2]));status=206;
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=file.size)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${file.size}`}});
 }
 const headers={'Content-Length':String(Math.max(0,end-start+1)),'Accept-Ranges':'bytes','Content-Type':'application/octet-stream','ETag':`"local-${file.size}"`};if(status===206)headers['Content-Range']=`bytes ${start}-${end}/${file.size}`;
 return new Response(options.method==='HEAD'?null:file.slice(start,end+1),{status,headers});
}
