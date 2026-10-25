import { readFileSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { isAbsolute } from 'node:path';
import type { Store } from '../state/store.js';
import type { LanguageAdapter, RepositoryContext } from './adapter.js';
import { AdapterRegistry, builtinRegistry } from './registry.js';
import { CommandSchema } from '../core/models.js';
import { within } from '../security/boundaries.js';
export interface TrustedAdapter {
  schemaVersion: 1;
  id: string;
  file: string;
  sha256: string;
  trustedAt: string;
}
export function adapterIntegrity(file: string): string {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}
export function conformAdapter(value: unknown): LanguageAdapter {
  if (!value || typeof value !== 'object') throw new Error('Adapter must export an object');
  const adapter = value as LanguageAdapter;
  if (
    !/^[a-z][a-z0-9-]{0,50}$/.test(adapter.id) ||
    !['detect', 'planEnvironment', 'commands', 'parseResults'].every(
      (k) => typeof (value as Record<string, unknown>)[k] === 'function',
    )
  )
    throw new Error('Adapter does not implement the version 1 interface');
  return {
    ...adapter,
    commands(repo: RepositoryContext) {
      return adapter.commands(repo).map((raw) => {
        const command = CommandSchema.parse(raw);
        within(repo.root, command.cwd);
        return command;
      });
    },
  };
}
export async function trustedRegistry(store: Store): Promise<AdapterRegistry> {
  const registry = builtinRegistry();
  for (const entry of store.read<TrustedAdapter[]>('config', 'trustedAdapters') ?? []) {
    if (
      entry.schemaVersion !== 1 ||
      !isAbsolute(entry.file) ||
      adapterIntegrity(entry.file) !== entry.sha256
    )
      throw new Error('Trusted adapter changed; renew trust before loading');
    const module = await import(
      pathToFileURL(realpathSync(entry.file)).href + '?integrity=' + entry.sha256
    );
    const adapter = conformAdapter(module.default);
    if (adapter.id !== entry.id) throw new Error('Adapter identity differs from trust record');
    registry.add(adapter);
  }
  return registry;
}
