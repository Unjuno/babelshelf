// Explicit local static HTTPS delivery only. No inference, upload or proxy route.
import https from 'node:https';
import {readFile} from 'node:fs/promises';
import {X509Certificate} from 'node:crypto';
import {networkInterfaces} from 'node:os';
import {resolve,relative,isAbsolute,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createStaticHandler} from './serve.mjs';
export async function createProductHttpsServer({certPath,keyPath,host='127.0.0.1'}){
 const addresses=new Set(['127.0.0.1','::1',...Object.values(networkInterfaces()).flat().filter(Boolean).map(v=>v.address)]);
 if(!addresses.has(host))throw Error('Host must be one explicit local interface IP');
 const root=fileURLToPath(new URL('../design/prototype/dist/app',import.meta.url));
 for(const path of [certPath,keyPath]){if(!path)throw Error('Provide certificate and private key paths');const rel=relative(root,resolve(path));if(!rel||!(rel==='..'||rel.startsWith('..'+sep)||isAbsolute(rel)))throw Error('TLS files must remain outside the served app directory');}
 const [cert,key]=await Promise.all([readFile(certPath),readFile(keyPath)]),certificate=new X509Certificate(cert);
 if(!certificate.checkIP(host))throw Error('Certificate must include the host IP in its subject alternative names');
 if(Date.now()<Date.parse(certificate.validFrom)||Date.now()>Date.parse(certificate.validTo))throw Error('Certificate is not currently valid');
 return https.createServer({cert,key,minVersion:'TLSv1.2'},createStaticHandler(root));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const options={host:'127.0.0.1',port:4183};const args=process.argv.slice(2),names={'--cert':'certPath','--key':'keyPath','--host':'host','--port':'port'};
 for(let i=0;i<args.length;i+=2){const name=names[args[i]];if(!name||!args[i+1])throw Error('Usage: --cert PATH --key PATH [--host LOCAL_IP] [--port 4183]');options[name]=args[i+1];}
 options.port=Number(options.port);if(!Number.isInteger(options.port)||options.port<1024||options.port>65535)throw Error('Invalid port');
 const server=await createProductHttpsServer(options);server.on('error',error=>{console.error(error.message);process.exitCode=1;});server.listen(options.port,options.host,()=>console.log('Local static PWA https://'+(options.host.includes(':')?'['+options.host+']':options.host)+':'+options.port));
}
