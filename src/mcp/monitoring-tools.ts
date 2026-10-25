import { z } from 'zod';
import type { Application } from './application.js';
import { sessionInput } from './registry.js';
import { monitorPullRequest } from '../contribution/monitor.js';
import { provider } from '../forges/router.js';
export function registerMonitoring(app: Application) {
  app.register({
    name: 'monitor_pull_request',
    description:
      'Poll CI, reviews and outcomes responsibly. Opened, closed and merged remain distinct; stop/resume controls apply.',
    schema: sessionInput.extend({ force: z.boolean().default(false) }),
    readOnly: false,
    publicWrite: false,
    handler: async (a) =>
      monitorPullRequest(
        app.store,
        String(a.sessionId),
        (await provider(app.store, app.store.get(String(a.sessionId)).repository)).client,
        Boolean(a.force),
        app.controls.signal(String(a.sessionId)),
      ),
  });
}
