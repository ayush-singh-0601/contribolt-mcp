import { it, expect, vi } from 'vitest';
import { writeFileSync } from 'node:fs';
import { Store } from '../src/state/store.js';
import { createApplication } from '../src/mcp/bootstrap.js';
import { publicToolNames } from '../src/mcp/registry.js';
import { executeCheck } from '../src/execution/runner.js';
import { inspectPatch } from '../src/contribution/quality.js';
import { Approvals } from '../src/security/approvals.js';
import { Publisher, GitHubPublicationBackend } from '../src/contribution/publisher.js';
import { fixture, gitFixture } from './helpers.js';

it('discovers, reproduces, validates, approves, publishes and revises through the complete tool interface', async () => {
  const repo = await gitFixture({
      '.gitignore': '__pycache__/\n',
      'README.md': '# Counter\n\n```sh\npython3 test.py\n```\n',
      'CONTRIBUTING.md': 'Contributions welcome. Open a pull request with focused tests.\n',
      LICENSE: 'MIT License\nCopyright fixture\n',
      'subject.py': 'def increment(value):\n    return value\n',
      'test.py':
        'from subject import increment\nassert increment(1) == 2\nprint("counter regression passed")\n',
    }),
    data = fixture(),
    store = new Store(data.root);
  try {
    const base = await repo.git('rev-parse', 'HEAD'),
      actor = 'fixture-contributor',
      owners = ['fixture-alpha', 'fixture-beta'];
    let forked = false,
      opened = false,
      pushedSha = '',
      prTitle = '',
      prBody = '',
      reviewChanges = false,
      merged = false;
    const writes: string[] = [];
    const metadata = (owner: string) => ({
      id: owners.indexOf(owner) + 1,
      full_name: owner + '/repo',
      html_url: `https://github.com/${owner}/repo`,
      clone_url: `https://github.com/${owner}/repo.git`,
      default_branch: 'main',
      private: false,
      archived: false,
      fork: false,
      has_issues: true,
      language: 'Python',
      stargazers_count: 20,
      pushed_at: new Date().toISOString(),
      owner: { login: owner, type: 'User' },
      license: { spdx_id: 'MIT' },
    });
    const issue = (owner: string) => ({
      number: 1,
      title: 'Counter does not increment',
      body: 'Steps to reproduce\n```sh\npython3 test.py\n```\nExpected: increment a value. Actual: value unchanged.',
      html_url: `https://github.com/${owner}/repo/issues/1`,
      state: 'open',
      comments: 0,
      assignees: [],
      user: { login: owner },
      author_association: 'OWNER',
      labels: [],
    });
    const fetcher = (async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = new URL(
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
        ),
        path = decodeURIComponent(url.pathname),
        method = init?.method ?? 'GET',
        body = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
      const send = (value: unknown, status = 200) =>
        new Response(JSON.stringify(value), {
          status,
          headers: { 'content-type': 'application/json' },
        });
      if (method !== 'GET' && path !== '/graphql') writes.push(method + ' ' + path);
      if (path === '/user') return send({ login: actor });
      if (path === '/search/repositories')
        return send({ items: owners.map(metadata), incomplete_results: false });
      if (path === '/search/issues') {
        const q = url.searchParams.get('q') ?? '';
        if (q.includes('is:pr'))
          return send({
            items: opened
              ? [
                  {
                    number: 42,
                    html_url: 'https://github.com/fixture-alpha/repo/pull/42',
                    title: prTitle,
                    body: prBody,
                    pull_request: { merged_at: null },
                  },
                ]
              : [],
            incomplete_results: false,
          });
        const match = q.match(/repo:([^\s]+)/);
        return send({
          items: match
            ? [issue(match[1]!.split('/')[0]!)]
            : owners.map((owner) => ({
                repository_url: `https://api.github.com/repos/${owner}/repo`,
              })),
          incomplete_results: false,
        });
      }
      if (path === '/graphql')
        return send({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  nodes: opened
                    ? [
                        {
                          source: {
                            __typename: 'PullRequest',
                            url: 'https://github.com/fixture-alpha/repo/pull/42',
                          },
                        },
                      ]
                    : [],
                  pageInfo: { hasNextPage: false, endCursor: null },
                },
              },
            },
          },
        });
      if (path.includes('/.github/')) return send({ message: 'Not found' }, 404);
      const owner = path.split('/')[2]!;
      if (path === `/repos/${actor}/repo`)
        return forked
          ? send({ ...metadata(actor), parent: { full_name: 'fixture-alpha/repo' } })
          : send({ message: 'Not found' }, 404);
      if (/^\/repos\/[^/]+\/repo$/.test(path)) return send(metadata(owner));
      if (path.endsWith('/languages')) return send({ Python: 100 });
      if (path.endsWith('/commits/main')) return send({ sha: base });
      if (path.includes('/git/trees/'))
        return send({
          tree: (await repo.git('ls-tree', '-r', '--name-only', base))
            .split('\n')
            .map((path) => ({ path, type: 'blob' })),
          truncated: false,
        });
      if (path.includes('/contents/')) {
        const file = path.split('/contents/')[1]!;
        try {
          const text = await repo.git('show', base + ':' + file),
            sha = await repo.git('rev-parse', base + ':' + file);
          return send({
            content: Buffer.from(text + '\n').toString('base64'),
            encoding: 'base64',
            sha,
            html_url: `https://github.com/${owner}/repo/blob/${base}/${file}`,
            size: text.length,
          });
        } catch {
          return send({ message: 'Not found' }, 404);
        }
      }
      if (path.endsWith('/issues/1')) return send(issue(owner));
      if (path.endsWith('/issues/1/timeline'))
        return send(
          opened
            ? [
                {
                  source: {
                    issue: {
                      pull_request: {},
                      html_url: 'https://github.com/fixture-alpha/repo/pull/42',
                    },
                  },
                },
              ]
            : [],
        );
      if (path.endsWith('/forks')) {
        forked = true;
        return send({ ...metadata(actor), parent: { full_name: 'fixture-alpha/repo' } });
      }
      if (path.endsWith('/pulls') && method === 'POST') {
        opened = true;
        prTitle = body.title;
        prBody = body.body;
        return send({
          number: 42,
          html_url: 'https://github.com/fixture-alpha/repo/pull/42',
          head: { sha: pushedSha },
        });
      }
      if (path.endsWith('/pulls')) {
        if (url.searchParams.get('head'))
          return send(
            opened
              ? [
                  {
                    number: 42,
                    html_url: 'https://github.com/fixture-alpha/repo/pull/42',
                    head: { sha: pushedSha },
                    base: { ref: 'main' },
                  },
                ]
              : [],
          );
        return send(
          Array.from({ length: 5 }, (_, i) => ({
            number: 100 + i,
            created_at: new Date().toISOString(),
            closed_at: new Date().toISOString(),
            merged_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            author_association: 'OWNER',
          })),
        );
      }
      if (/\/pulls\/\d+\/reviews$/.test(path)) {
        if (path.includes('/pulls/42/'))
          return send(
            reviewChanges
              ? [
                  {
                    id: 5,
                    user: { login: 'fixture-alpha', type: 'User' },
                    body: 'Please reject boolean inputs.',
                    html_url: 'https://github.com/fixture-alpha/repo/pull/42#pullrequestreview-5',
                    state: 'CHANGES_REQUESTED',
                    commit_id: pushedSha,
                  },
                ]
              : [],
          );
        return send([{ submitted_at: new Date().toISOString() }]);
      }
      if (path.endsWith('/requested_reviewers')) return send({ users: [], teams: [] });
      if (path.endsWith('/comments')) return send([]);
      if (path.includes('/git/ref/heads/')) return send({ object: { sha: pushedSha } });
      if (path.endsWith('/pulls/42')) {
        if (method === 'PATCH') {
          prTitle = body.title;
          prBody = body.body;
        }
        return send({
          number: 42,
          title: prTitle,
          body: prBody,
          state: 'open',
          merged_at: merged ? new Date().toISOString() : null,
          head: { sha: pushedSha },
        });
      }
      if (path.endsWith('/check-runs'))
        return send({
          total_count: 1,
          check_runs: [
            {
              name: 'counter',
              status: 'completed',
              conclusion: 'success',
              html_url: 'https://github.com/fixture-alpha/repo/actions/runs/1',
            },
          ],
        });
      if (path.endsWith('/status')) return send({ statuses: [] });
      throw new Error('Unexpected mocked GitHub request: ' + method + ' ' + path);
    }) as typeof fetch;
    vi.stubGlobal('fetch', fetcher);
    vi.stubEnv('MERGEPILOT_GITHUB_TOKEN', 'fixture-only-token');
    vi.stubEnv('MERGEPILOT_FORGES', '[]');
    const app = createApplication(store, {
      workspaceFactory: async () => ({ root: repo.root, sha: base }),
      publicationFactory: (context) => {
        class ControlledBackend extends GitHubPublicationBackend {
          override async push(_session: unknown, _fork: unknown, sha: string) {
            pushedSha = sha;
          }
        }
        return new Publisher(
          store,
          new ControlledBackend(context.client, context.auth),
          context.recheck,
        );
      },
      revisionPush: async (_s, _fork, sha) => {
        pushedSha = sha;
      },
    });
    expect(publicToolNames.every((name) => app.tools.has(name))).toBe(true);
    const started = (await app.callTool('start_contribution', { dryRun: false })) as {
        sessionId: string;
      },
      id = started.sessionId;
    await app.callTool('set_preferences', {
      sessionId: id,
      preferences: { languages: ['Python'], difficulty: 'intermediate' },
    });
    await app.callTool('discover_repositories', { sessionId: id });
    expect(store.get(id).repositories).toHaveLength(2);
    await app.callTool('find_eligible_issues', { sessionId: id });
    expect(store.get(id).selectedIssue?.repoFullName).toBe('fixture-alpha/repo');
    await app.callTool('analyze_repository', { sessionId: id });
    const analysis = {
      expected: 'Increment an integer by one',
      actual: 'Value remains unchanged',
      rootCause: 'The increment operation is missing',
      strategy: 'Increment the value and add an edge-case regression test',
      files: ['subject.py', 'test.py'],
      evidenceUrls: ['subject.py:1', 'test.py:1'],
      reproduced: true,
      reproductionExplanation: 'The native Python regression command fails before the patch',
      highRisk: false,
    };
    await app.callTool('record_analysis', { sessionId: id, analysis });
    await app.callTool('plan_fix', { sessionId: id });
    await app.callTool('get_execution_plan', { sessionId: id });
    const command = store.get(id).commands.find((c) => c.kind === 'test')!;
    const baseline = await executeCheck(store, id, command.id, {
      source: 'host-approved-execution',
      network: false,
    });
    expect(baseline.check.status).toBe('FAIL');
    expect(baseline.check.exitCode).not.toBe(0);
    writeFileSync(repo.root + '/subject.py', 'def increment(value):\n    return value + 1\n');
    writeFileSync(
      repo.root + '/test.py',
      'from subject import increment\nassert increment(1) == 2\nassert increment(0) == 1\nprint("2 counter regression checks passed")\n',
    );
    const validate = async () => {
      await app.callTool('get_execution_plan', { sessionId: id });
      const c = store.get(id).commands.find((c) => c.kind === 'test')!,
        run = await executeCheck(store, id, c.id, {
          source: 'host-approved-execution',
          network: false,
        });
      expect(run.check.status).toBe('PASS');
      await app.callTool('record_check_result', { sessionId: id, executionIds: [run.id] });
      const inspection = await inspectPatch(store.get(id));
      await app.callTool('check_patch', {
        sessionId: id,
        critique: {
          patchHash: inspection.patchHash,
          findings: [],
          reviewedAt: new Date().toISOString(),
          reviewer: 'separate fixture review',
        },
      });
      expect(store.get(id).state).toBe('PRE_SUBMISSION_RECHECK');
      await app.callTool('prepare_pull_request', {
        sessionId: id,
        proposal: {
          actor,
          authorName: 'Fixture Contributor',
          authorEmail: 'fixture@example.invalid',
          title: 'Correct the counter behavior',
        },
      });
    };
    await validate();
    const approval = (await app.callTool('request_approval', { sessionId: id })) as {
      request: { id: string };
    };
    await expect(
      app.callTool('publish_pull_request', { sessionId: id, approvalId: approval.request.id }),
    ).rejects.toThrow('authorization');
    expect(writes).toHaveLength(0);
    await new Approvals(store).confirmFromHuman(approval.request.id);
    const published = (await app.callTool('publish_pull_request', {
      sessionId: id,
      approvalId: approval.request.id,
    })) as { number: number };
    expect(published.number).toBe(42);
    expect(writes.filter((p) => p.endsWith('/pulls'))).toHaveLength(1);
    await app.callTool('route_review', { sessionId: id });
    reviewChanges = true;
    await app.callTool('monitor_pull_request', { sessionId: id });
    const plan = {
      analysis: {
        ...analysis,
        expected: 'Reject booleans',
        actual: 'True is incremented as an integer',
        rootCause: 'Boolean values are integer subclasses',
        strategy: 'Reject non-integer input and cover the review edge case',
      },
      feedbackIds: ['review:5'],
      reviewedHeadSha: pushedSha,
    };
    await app.callTool('plan_revision', { sessionId: id, plan });
    const coding = (await app.callTool('request_approval', {
      sessionId: id,
      action: 'revision_implementation',
    })) as { request: { id: string } };
    await new Approvals(store).confirmFromHuman(coding.request.id);
    await app.callTool('plan_revision', { sessionId: id, plan, approvalId: coding.request.id });
    writeFileSync(
      repo.root + '/subject.py',
      'def increment(value):\n    if type(value) is not int:\n        raise TypeError("Expected an integer")\n    return value + 1\n',
    );
    writeFileSync(
      repo.root + '/test.py',
      'from subject import increment\nassert increment(1) == 2\nassert increment(0) == 1\ntry:\n    increment(True)\n    raise AssertionError("Boolean accepted")\nexcept TypeError:\n    pass\nprint("3 counter regression checks passed")\n',
    );
    await validate();
    const revision = (await app.callTool('request_approval', {
      sessionId: id,
      action: 'revision_publish',
    })) as { request: { id: string } };
    await new Approvals(store).confirmFromHuman(revision.request.id);
    await app.callTool('publish_revision', { sessionId: id, approvalId: revision.request.id });
    expect(writes.filter((p) => p.endsWith('/pulls'))).toHaveLength(1);
    expect(await repo.git('rev-list', '--count', 'HEAD')).toBe('3');
    reviewChanges = false;
    merged = true;
    store.remove('monitor', id);
    const outcome = (await app.callTool('monitor_pull_request', { sessionId: id })) as {
      outcome: string;
    };
    expect(outcome.outcome).toBe('merged');
    expect(store.get(id).state).toBe('DONE');
    expect(writes.some((p) => p.endsWith('/merge'))).toBe(false);
  } finally {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    store.close();
    data.cleanup();
    repo.cleanup();
  }
}, 30000);
