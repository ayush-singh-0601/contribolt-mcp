import { z } from 'zod';
import type { Application } from './application.js';
import { sessionInput } from './registry.js';
import { planEnvironment } from '../languages/environment.js';
import { trustedRegistry } from '../languages/extensions.js';
import { cachedIndex, affectedDependents } from '../repository/cache.js';
import { ingestExecutions } from '../execution/evidence.js';
export function registerExecution(app: Application) {
  app.tools.delete('get_execution_plan');
  app.register({
    name: 'get_execution_plan',
    description:
      'Discover native checks and provide host-approved wrapper invocations. No repository script runs inside this MCP call.',
    schema: sessionInput,
    readOnly: false,
    publicWrite: false,
    handler: async (a) => {
      const id = String(a.sessionId),
        s = app.store.get(id);
      if (!s.workspace || !s.analysis || s.stopped)
        throw new Error('Active analyzed workspace required');
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
      app.store.mutate(id, (x) => {
        x.commands = plan.commands;
        x.publishApproved = false;
      });
      return {
        ...plan,
        invocations: plan.commands.map((c) => ({
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
