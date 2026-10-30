import {Client} from '@modelcontextprotocol/client';
import {createLocalMcpServer} from '../src/mcp-local-adapter.ts';

Object.assign(window,{mcpBrowserFixture:async()=>{
 const server=createLocalMcpServer({tools:[{id:'math.calculate',effect:'read',network:'none',inputSchema:{type:'object',required:['value'],additionalProperties:false,properties:{value:{type:'number'}}}}],invoke:async(_id,args)=>({result:Number(args.value)*2})});
 const client=new Client({name:'browser-fixture',version:'1'});
 try{await client.connect(await server.connect());const listed=await client.listTools(),result=await client.callTool({name:'math.calculate',arguments:{value:21}});return {names:listed.tools.map(tool=>tool.name),result};}
 finally{await client.close();await server.close();}
}});
document.querySelector('#root')!.textContent='ready';
