import { parseArgs } from 'node:util';
import { z } from 'zod';
import { configureClient, serverDefinition, clients } from './configure.js';
export function configureCommand(args: string[]): void {
  const parsed = parseArgs({
    args,
    allowPositionals: true,
    options: {
      project: { type: 'string', default: process.cwd() },
      local: { type: 'boolean', default: false },
      print: { type: 'boolean', default: false },
    },
  });
  const client = z.enum(clients).parse(parsed.positionals[0]);
  if (parsed.positionals.length !== 1) throw new Error('configure requires exactly one client');
  if (parsed.values.print) {
    console.log(
      JSON.stringify(
        { client, definition: serverDefinition(parsed.values.project!, parsed.values.local) },
        null,
        2,
      ),
    );
    return;
  }
  console.log(JSON.stringify(configureClient(client, parsed.values.project!, parsed.values.local)));
}
