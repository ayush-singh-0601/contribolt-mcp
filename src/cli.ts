#!/usr/bin/env node
import { Console } from 'node:console';
import { stdioOutput } from './mcp/output.js';
import { NODE_REQUIREMENT, supportedRuntime } from './runtime/version.js';
const output = stdioOutput(),
  errors = stdioOutput(2);
globalThis.console = new Console({ stdout: output, stderr: errors });
if (process.argv[2] === 'doctor') {
  const { doctorCommand } = await import('./runtime/doctor.js');
  await doctorCommand(process.argv.slice(3)).catch((error) => {
    console.error(String(error));
    process.exitCode = 1;
  });
} else if (!supportedRuntime()) {
  console.error(
    `ContriBolt requires ${NODE_REQUIREMENT}; detected ${process.versions.node}. Select a supported Node runtime, then rebuild and reconfigure the client. Run contribolt doctor --json for diagnostics.`,
  );
  process.exitCode = 1;
} else {
  const { main } = await import('./main.js');
  await main().catch((error) => {
    console.error(String(error));
    process.exitCode = 1;
  });
}

await Promise.all(
  [output, errors].map(
    (stream) =>
      new Promise<void>((resolve, reject) =>
        stream.write('', (error) => (error ? reject(error) : resolve())),
      ),
  ),
);
