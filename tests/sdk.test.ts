import {it,expect} from 'vitest';
import {z} from 'zod';
import {ToolRegistry} from '../src/mcp/registry.js';
import {officialServer} from '../src/mcp/sdk.js';

it('registers tools, six prompts and resources through the SDK factory contract',async()=>{
  const tools=new Map<string,(args:Record<string,unknown>)=>Promise<any>>(),prompts:string[]=[],resources:string[]=[];
  class Server{registerTool(name:string,_config:unknown,handler:(args:Record<string,unknown>)=>Promise<any>){tools.set(name,handler);}registerPrompt(name:string){prompts.push(name);}registerResource(name:string){resources.push(name);}}
  class Template{constructor(public uri:string,public options:unknown){}}
  const registry=Object.assign(new ToolRegistry(),{resources:()=>[],readResource:async()=>({contents:[]})});registry.register({name:'status',description:'Fixture',schema:z.object({}),readOnly:true,publicWrite:false,handler:async()=>({token:'ghp_'+'a'.repeat(36)})});
  officialServer(registry,{McpServer:Server,ResourceTemplate:Template});expect(prompts).toHaveLength(6);expect(resources).toEqual(['sessions','artifacts']);const result=await tools.get('status')!({});expect(JSON.stringify(result)).not.toContain('a'.repeat(36));expect(result.structuredContent).toHaveProperty('token');
});
