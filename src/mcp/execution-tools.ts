import { z } from 'zod';
import type { Application } from './application.js';
import { sessionInput } from './registry.js';
import { planEnvironment } from '../languages/environment.js';
import { trustedRegistry } from '../languages/extensions.js';
import { cachedIndex, affectedDependents } from '../repository/cache.js';
import { ingestExecutions } from '../execution/evidence.js';
import { CommandSchema, type CheckCommand } from '../core/models.js';
import { within } from '../security/boundaries.js';
import { redact } from '../core/audit.js';
import { ciCommandCandidates } from '../languages/ci.js';
export function registerExecution(app: Application) {
  app.tools.delete('get_execution_plan');
  app.register({
    name: 'get_execution_plan',
    description:
      'Discover native checks and provide host-approved wrapper invocations. No repository script runs inside this MCP call.',
    schema: sessionInput.extend({
      additionalCommands: z.array(CommandSchema.strict()).max(20).optional(),
    }),
    readOnly: false,
    publicWrite: false,
    handler: async (a) => {
      const id = String(a.sessionId),
        s = app.store.get(id);
      if (!s.workspace || !s.analysis || s.stopped)
        throw new Error('Active analyzed workspace required');
      const extra =
        (a.additionalCommands as CheckCommand[] | undefined) ??
        app.store.read<CheckCommand[]>('extra-commands', id) ??
        [];
      for (const c of extra) {
        within(s.workspace, c.cwd);
        if (JSON.stringify(redact(c)) !== JSON.stringify(c))
          throw new Error('Command plan contains a potential secret');
        if (c.kind === 'bootstrap' && !c.network)
          throw new Error('Bootstrap commands require explicit network review');
      }
      const index = await cachedIndex(
          app.store,
          s.workspace,
          s.repository?.host + ':' + s.repository?.id,
        ),
        plan = planEnvironment(
          s.workspace,
          index,
          await trustedRegistry(app.store),
          affectedDependents(index, s.analysis.files),
        );
      const commands = [...plan.commands, ...extra];
      if (new Set(commands.map((c) => c.id)).size !== commands.length)
        throw new Error('Additional command IDs must be unique');
      app.store.put('extra-commands', id, extra);
      app.store.mutate(id, (x) => {
        x.commands = commands;
        x.publishApproved = false;
      });
      return {
        ...plan,
        commands,
        ciCommandCandidates: ciCommandCandidates(index),
        invocations: commands.map((c) => ({
          id: c.id,
          executable: 'mergepilot',
          args: ['run-check', id, c.id, '--host-approved'],
        })),
        notice:
          'Invoke only through the approved host execution environment. The wrapper captures evidence and does not create a sandbox. Bootstrap/network actions require separate permission.',
      };
    },
  });
  app.register({
    name: 'record_check_result',
    description:
      'Verify actual wrapper execution records and log hashes; arbitrary claimed passes are rejected.',
    schema: sessionInput.extend({ executionIds: z.array(z.uuid()).min(1).max(100) }),
    readOnly: false,
    publicWrite: false,
    handler: async (a) => ({
      checks: await ingestExecutions(app.store, String(a.sessionId), a.executionIds as string[]),
      nextAction: 'check_patch',
    }),
  });
}
