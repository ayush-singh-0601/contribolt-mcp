import {z} from 'zod';
import type {ProtocolHandler} from './transport.js';
import {assertBounded} from '../security/boundaries.js';
export const publicToolNames=['start_contribution','set_preferences','discover_repositories','find_eligible_issues','verify_issue','analyze_repository','plan_fix','check_patch','prepare_pull_request','publish_pull_request','route_review','get_status','resume_session','record_analysis','get_execution_plan','record_check_result','control_session','request_approval','monitor_pull_request','plan_revision','publish_revision'] as const;
export interface ToolDefinition {name:string;description:string;schema:z.ZodType;readOnly:boolean;publicWrite:boolean;handler:(args:Record<string,unknown>)=>Promise<unknown>;}
export class ToolRegistry implements ProtocolHandler {
  readonly tools=new Map<string,ToolDefinition>();
  register(tool:ToolDefinition):void {if(this.tools.has(tool.name))throw new Error('Duplicate tool');this.tools.set(tool.name,tool);}
  listTools(){return [...this.tools.values()].sort((a,b)=>a.name.localeCompare(b.name)).map(t=>({name:t.name,description:t.description,inputSchema:z.toJSONSchema(t.schema),annotations:{readOnlyHint:t.readOnly,destructiveHint:t.publicWrite,openWorldHint:!['get_status','get_execution_plan'].includes(t.name)}}));}
  async callTool(name:string,args:unknown){assertBounded(args);const tool=this.tools.get(name);if(!tool)throw new Error('Unknown or unavailable tool');const parsed=tool.schema.parse(args) as Record<string,unknown>;return tool.handler(parsed);}
}
export const sessionInput=z.object({sessionId:z.uuid()}).strict();
