import type {ToolRegistry} from './registry.js';
/** Uses the official SDK when installed; compatibility transport is explicitly reported otherwise. */
export async function serveOfficialSdk(registry:ToolRegistry):Promise<boolean>{
  const serverPackage='@modelcontextprotocol/server',stdioPackage='@modelcontextprotocol/server/stdio';
  let imported:Record<string,unknown>,stdio:Record<string,unknown>;
  try{imported=await import(serverPackage);stdio=await import(stdioPackage);}catch(error){if((error as NodeJS.ErrnoException).code==='ERR_MODULE_NOT_FOUND')return false;throw error;}
  type Sdk={registerTool(name:string,config:unknown,handler:(args:Record<string,unknown>)=>Promise<unknown>):void;connect(transport:unknown):Promise<void>};
  const Server=imported.McpServer as new(info:unknown)=>Sdk;
  const Transport=stdio.StdioServerTransport as new()=>unknown;
  const server=new Server({name:'mergepilot',version:'0.1.0'});
  for(const tool of registry.tools.values())server.registerTool(tool.name,{description:tool.description,inputSchema:tool.schema,annotations:{readOnlyHint:tool.readOnly,destructiveHint:tool.publicWrite,openWorldHint:true}},async args=>{try{const result=await registry.callTool(tool.name,args);return {content:[{type:'text',text:JSON.stringify(result)}],structuredContent:result};}catch(error){return {isError:true,content:[{type:'text',text:String(error)}]};}});
  await server.connect(new Transport());return true;
}
