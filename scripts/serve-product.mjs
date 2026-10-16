import {createDevServer} from './serve.mjs';
const port=Number(process.argv[2]??4182);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid port');
const server=createDevServer('design/prototype/dist/app');server.on('error',e=>{console.error(e.message);process.exitCode=1;});server.listen(port,'127.0.0.1',()=>console.log('Product PWA http://127.0.0.1:'+port));
