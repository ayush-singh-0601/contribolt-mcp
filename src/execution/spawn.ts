import { existsSync } from 'node:fs';
import { win32 } from 'node:path';
import type { CheckCommand } from '../core/models.js';

export function processInvocation(
  command: CheckCommand,
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): { executable: string; args: string[] } {
  if (platform !== 'win32') return { executable: command.executable, args: command.args };
  let executable = command.executable;
  if (!/\.[a-z]+$/i.test(executable)) {
    const candidates = (env.PATH ?? '')
      .split(';')
      .flatMap((directory) =>
        ['.exe', '.cmd', '.bat'].map((extension) => win32.join(directory, executable + extension)),
      );
    executable = candidates.find((file) => existsSync(file)) ?? executable;
  }
  if (!/\.(?:cmd|bat)$/i.test(executable)) return { executable, args: command.args };
  const values = [executable, ...command.args];
  if (values.some((value) => /["%!^&|<>\r\n()]/.test(value)))
    throw new Error(
      'Windows command wrapper contains shell syntax; use a native executable or a reviewed project script',
    );
  return {
    executable: env.ComSpec ?? 'cmd.exe',
    args: ['/d', '/s', '/c', '"' + values.map((value) => '"' + value + '"').join(' ') + '"'],
  };
}
