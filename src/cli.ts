#!/usr/bin/env node
import { Console } from 'node:console';
import { stdioOutput } from './mcp/output.js';
const output = stdioOutput(),
  errors = stdioOutput(2);
globalThis.console = new Console({ stdout: output, stderr: errors });
const major = Number(process.versions.node.split('.')[0]);
if (process.argv[2] === 'doctor') {
  const { doctorCommand } = await import('./runtime/doctor.js');
  await doctorCommand(process.argv.slice(3)).catch((error) => {
    console.error(String(error));
    process.exitCode = 1;
  });
} else if (major < 24) {
  console.error(
    `MergePilot requires Node.js 24 or newer; detected ${process.versions.node}. Select a supported Node runtime, then rebuild and reconfigure the client. Run mergepilot doctor --json for diagnostics.`,
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
