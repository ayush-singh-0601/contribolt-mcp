import {it,expect} from 'vitest';
import {z} from 'zod';
import {ToolRegistry} from '../src/mcp/registry.js';
it('validates requests before entering handlers',async()=>{let calls=0;const r=new ToolRegistry();r.register({name:'x',description:'x',schema:z.object({sessionId:z.uuid()}).strict(),readOnly:true,publicWrite:false,handler:async()=>++calls});await expect(r.callTool('x',{sessionId:'bad',approved:true})).rejects.toThrow();expect(calls).toBe(0);expect(r.listTools()).toHaveLength(1);});
