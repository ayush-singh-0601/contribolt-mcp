import type { ToolRegistry } from './registry.js';
import type { ProtocolHandler } from './transport.js';
import { redact } from '../core/audit.js';
import { VERSION } from '../index.js';
type Registry = ToolRegistry & Partial<Pick<ProtocolHandler, 'resources' | 'readResource'>>;
interface SdkServer {
  registerTool(
    name: string,
    config: unknown,
    handler: (args: Record<string, unknown>) => Promise<unknown>,
  ): void;
  registerPrompt(name: string, config: unknown, handler: () => unknown): void;
  registerResource(
    name: string,
    template: unknown,
    config: unknown,
    handler: (uri: URL) => Promise<unknown>,
  ): void;
}
export function officialServer(registry: Registry, sdk: Record<string, unknown>): SdkServer {
  const Server = sdk.McpServer as new (info: unknown, options?: unknown) => SdkServer,
    Template = sdk.ResourceTemplate as new (uri: string, options: unknown) => unknown;
  const server = new Server(
    { name: 'mergepilot', version: VERSION },
    {
      instructions:
        'Start with start_contribution, follow nextAction, and obtain exact human action approval before public writes.',
    },
  );
  for (const tool of registry.tools.values())
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.schema,
        annotations: {
          readOnlyHint: tool.readOnly,
          destructiveHint: tool.publicWrite,
          openWorldHint: true,
        },
      },
      async (args) => {
        try {
          const result = redact(await registry.callTool(tool.name, args));
          return {
            content: [{ type: 'text', text: JSON.stringify(result) }],
            structuredContent: result,
          };
        } catch (error) {
          return {
            isError: true,
            content: [{ type: 'text', text: String(redact(String(error))) }],
          };
        }
      },
    );
  for (const prompt of registry.prompts())
    server.registerPrompt(prompt.name, { description: prompt.description }, () =>
      registry.getPrompt(prompt.name),
    );
  if (registry.readResource) {
    server.registerResource(
      'sessions',
      new Template('mergepilot://session/{sessionId}', {
        list: async () => ({ resources: registry.resources?.() ?? [] }),
      }),
      { mimeType: 'application/json' },
      async (uri) => redact(await registry.readResource!(uri.href)),
    );
    server.registerResource(
      'artifacts',
      new Template('mergepilot://session/{sessionId}/{artifact}', { list: undefined }),
      { mimeType: 'text/plain' },
      async (uri) => redact(await registry.readResource!(uri.href)),
    );
  }
  return server;
}
export async function serveOfficialSdk(registry: Registry): Promise<boolean> {
  const serverPackage = '@modelcontextprotocol/server',
    stdioPackage = '@modelcontextprotocol/server/stdio';
  let location: string;
  try {
    location = import.meta.resolve(serverPackage);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ERR_MODULE_NOT_FOUND') return false;
    throw error;
  }
  const sdk = (await import(location)) as Record<string, unknown>,
    stdio = (await import(stdioPackage)) as {
      serveStdio: (factory: () => SdkServer) => { close(): Promise<void> };
    };
  const handle = stdio.serveStdio(() => officialServer(registry, sdk));
  process.once('SIGINT', () => {
    void handle.close();
  });
  return true;
}
