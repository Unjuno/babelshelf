import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const types={'.mjs':'text/javascript; charset=utf-8','.wasm':'application/wasm','.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.txt':'text/plain; charset=utf-8','.md':'text/plain; charset=utf-8'};
export function createDevServer(root){
 root=path.resolve(root);
 return http.createServer(async(req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  try{
   let requestPath=decodeURIComponent(req.url.split('?')[0]);
   if(requestPath.includes('\\')||requestPath.includes('\0')||requestPath.split('/').includes('..')){res.writeHead(403);res.end();return;}
   if(requestPath==='/')requestPath='/index.html';
   const filename=path.resolve(root,'.'+requestPath);if(!filename.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
   const info=await fs.stat(filename);if(!info.isFile()){res.writeHead(404);res.end();return;}
   const bytes=await fs.readFile(filename);res.writeHead(200,{'Content-Type':types[path.extname(filename)]??'application/octet-stream','Content-Length':bytes.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:bytes);
  }catch(e){res.writeHead(e.code==='ENOENT'?404:400);res.end();}
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const args=process.argv.slice(2);let port=4173;
 if(args.length){if(args.length!==2||args[0]!=='--port')throw Error('Usage: node scripts/serve.mjs [--port 4173]');port=Number(args[1]);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid port');}
 const root=fileURLToPath(new URL('../dist/',import.meta.url));const server=createDevServer(root);server.on('error',e=>{console.error(e.message);process.exitCode=1;});server.listen(port,'127.0.0.1',()=>console.log('http://localhost:'+port));
}
