import { it, expect } from 'vitest';
import { reservationSources } from '../src/discovery/reservations.js';
import { reservation } from '../src/discovery/eligibility.js';
import type { GitHubClient } from '../src/github/client.js';
import type { IssueEvidence, Repository } from '../src/core/models.js';
const repo = { fullName: 'o/r', url: 'https://github.com/o/r' } as Repository;
const issue = { issueNumber: 1, reservationHints: [] } as unknown as IssueEvidence;
it('checks upstream branch activity, milestone ownership and project user fields', async () => {
  const client = {
    pages: async () => ({ items: [{ name: 'fix/issue-1-counter' }], complete: true }),
    graphql: async () => ({
      repository: {
        issue: {
          projectItems: {
            pageInfo: { hasNextPage: false },
            nodes: [
              {
                project: { url: 'https://github.com/orgs/o/projects/1' },
                fieldValues: {
                  pageInfo: { hasNextPage: false },
                  nodes: [
                    {
                      __typename: 'ProjectV2ItemFieldUserValue',
                      users: { nodes: [{ login: 'maintainer' }], pageInfo: { hasNextPage: false } },
                    },
                  ],
                },
              },
            ],
          },
        },
      },
    }),
  } as unknown as GitHubClient;
  const result = await reservationSources(
    client,
    repo,
    { ...issue, reservationHints: ['owner: maintainer'] },
    [],
  );
  expect(result.complete).toBe(true);
  expect(result.reservations).toHaveLength(3);
  expect(reservation('', [], result.reservations, result.complete)).toBe(true);
});
it('does not infer unreserved work from missing or partial project evidence', async () => {
  const client = {
    pages: async () => ({ items: [], complete: true }),
    graphql: async () => ({ repository: { issue: {} } }),
  } as unknown as GitHubClient;
  const result = await reservationSources(client, repo, issue, []);
  expect(result.complete).toBe(false);
  expect(reservation('', [], result.reservations, result.complete)).toBeNull();
});
it('requires a selected issue reference before treating documentation as its reservation', async () => {
  const client = {
    pages: async () => ({ items: [], complete: true }),
    graphql: async () => ({
      repository: { issue: { projectItems: { pageInfo: { hasNextPage: false }, nodes: [] } } },
    }),
  } as unknown as GitHubClient;
  const docs = [
    {
      path: 'CONTRIBUTING.md',
      text: '#1 reserved for maintainer\n#2 assigned to another person',
      url: 'https://github.com/o/r/blob/main/CONTRIBUTING.md',
      sha: 'abc',
      scope: '',
      organizationDefault: false,
    },
  ];
  expect((await reservationSources(client, repo, issue, docs)).reservations).toEqual([
    '#1 reserved for maintainer',
  ]);
});
