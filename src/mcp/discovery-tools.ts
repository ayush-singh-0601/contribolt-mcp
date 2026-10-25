import { z } from 'zod';
import type { Application } from './application.js';
import { sessionInput } from './registry.js';
import { provider, discoverAcrossForges, findAcrossForges } from '../forges/router.js';
import { nextAction } from '../core/workflow.js';
export function registerDiscovery(app: Application) {
  app.register({
    name: 'discover_repositories',
    description: 'Discover diverse public repositories without requiring a repository URL.',
    schema: sessionInput,
    readOnly: false,
    publicWrite: false,
    handler: async (a) => {
      const id = String(a.sessionId),
        s = app.store.get(id);
      if (s.state !== 'REPOSITORY_DISCOVERY' || s.stopped)
        throw new Error('Session is not ready for repository discovery');
      const discovery = await discoverAcrossForges(
        app.store,
        s.preferences,
        app.controls.signal(id),
      );
      const repos = discovery.repositories;
      app.store.put('discovery-errors', id, discovery.errors);
      const updated = app.store.mutate(
        id,
        (x) => {
          x.repositories = repos;
          x.state = 'ISSUE_DISCOVERY';
        },
        s.revision,
      );
      return { repositories: repos, nextAction: nextAction(updated) };
    },
  });
  app.register({
    name: 'find_eligible_issues',
    description:
      'Verify strict eligibility and automatically select the strongest qualified issue.',
    schema: sessionInput,
    readOnly: false,
    publicWrite: false,
    handler: async (a) => {
      const id = String(a.sessionId),
        s = app.store.get(id);
      if (s.state !== 'ISSUE_DISCOVERY' || s.stopped)
        throw new Error('Discover repositories first');
      const result = await findAcrossForges(
        app.store,
        s.repositories,
        s.preferences,
        app.controls.signal(id),
      );
      const updated = app.store.mutate(
        id,
        (x) => {
          x.candidates = result.candidates;
          if (result.selected) {
            x.selectedIssue = result.selected;
            x.repository = x.repositories.find(
              (r) =>
                r.fullName === result.selected?.repoFullName &&
                result.selected.url.startsWith('https://' + r.host + '/'),
            );
            x.state = 'PROJECT_POLICY_GATE';
            x.policyDecision = result.selected.repositoryPolicy;
          } else {
            x.blockers = ['No verified matches'];
          }
        },
        s.revision,
      );
      return { ...result, nextAction: nextAction(updated) };
    },
  });
  app.register({
    name: 'verify_issue',
    description: 'Refresh authoritative issue and policy evidence; unknown data never passes.',
    schema: sessionInput.extend({ issueNumber: z.number().int().positive().optional() }),
    readOnly: false,
    publicWrite: false,
    handler: async (a) => {
      const id = String(a.sessionId),
        s = app.store.get(id);
      if (!s.repository) throw new Error('Select a repository first');
      const number = (a.issueNumber as number | undefined) ?? s.selectedIssue?.issueNumber;
      if (!number) throw new Error('No selected issue');
      const evidence = await (
        await provider(app.store, s.repository)
      ).engine.verify(s.repository, number, app.controls.signal(id));
      app.store.mutate(
        id,
        (x) => {
          x.selectedIssue = evidence;
          x.publishApproved = false;
        },
        s.revision,
      );
      return evidence;
    },
  });
}
