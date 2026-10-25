import { it, expect, vi } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync, existsSync, symlinkSync } from 'node:fs';
import { createHmac, randomUUID } from 'node:crypto';
import { Store } from '../src/state/store.js';
import { PreferencesSchema, RepoSchema, CommandSchema } from '../src/core/models.js';
import { Approvals } from '../src/security/approvals.js';
import { SessionControls } from '../src/state/controls.js';
import { git } from '../src/git/workspace.js';
import { DiscoveryEngine } from '../src/discovery/engine.js';
import { GitHubClient } from '../src/github/client.js';
import { mapIssue, type RawIssue } from '../src/discovery/issues.js';
import { WebhookReceiver } from '../src/github/webhooks.js';
import { executeCheck, runProcess } from '../src/execution/runner.js';
import { HttpService } from '../src/http/server.js';
import { summarize } from '../src/http/metadata.js';
import { processInvocation } from '../src/execution/spawn.js';
import { fixture, gitFixture } from './helpers.js';

const repository = () =>
  RepoSchema.parse({
    id: '1',
    fullName: 'o/r',
    url: 'https://github.com/o/r',
    cloneUrl: 'https://github.com/o/r.git',
    defaultBranch: 'main',
    public: true,
    archived: false,
    fork: false,
    hasIssues: true,
    updatedAt: new Date().toISOString(),
  });
const raw = (number = 1): RawIssue => ({
  number,
  html_url: `https://github.com/o/r/issues/${number}`,
  title: 'A precise reproducible issue',
  body: 'Expected behavior and reproduction steps',
  state: 'open',
  comments: 0,
  assignees: [],
  user: { login: 'o' },
  author_association: 'OWNER',
  labels: [],
});

it('quotes Windows package-manager wrappers and refuses shell expansion', () => {
  const command = CommandSchema.parse({
    id: 'win',
    name: 'npm test',
    kind: 'test',
    executable: 'C:\\Program Files\\nodejs\\npm.cmd',
    args: ['run', 'test', '--', 'a file'],
    cwd: 'C:\\project',
    source: 'fixture',
  });
  expect(processInvocation(command, 'win32', { ComSpec: 'cmd.exe' })).toEqual({
    executable: 'cmd.exe',
    args: ['/d', '/s', '/c', '""C:\\Program Files\\nodejs\\npm.cmd" "run" "test" "--" "a file""'],
  });
  expect(() => processInvocation({ ...command, args: ['%TOKEN%'] }, 'win32')).toThrow(
    'shell syntax',
  );
  expect(processInvocation(command, 'linux').args).toEqual(command.args);
});
it('does not call a truncated page a complete competition scan', async () => {
  const client = new GitHubClient(
    { kind: 'token', token: async () => 'fixture' },
    async () =>
      new Response(JSON.stringify(Array.from({ length: 50 }, (_, i) => ({ id: i }))), {
        headers: { 'content-type': 'application/json' },
      }),
  );
  const result = await client.pages('/fixture', {}, 30);
  expect(result.items).toHaveLength(30);
  expect(result.complete).toBe(false);
});

it('redacts persisted records, sessions, events and artifacts and refuses secret approval previews', () => {
  const f = fixture(),
    store = new Store(f.root),
    secret = 'ghp_' + 'x'.repeat(36);
  try {
    const s = store.create(PreferencesSchema.parse({}));
    store.mutate(s.id, (x) => {
      x.blockers = [secret];
    });
    store.put('fixture', 'secret', { authorization: secret, message: secret });
    store.event(s.id, 'fixture', { message: secret });
    const path = store.artifact(s.id, 'fixture.log', secret);
    expect(
      JSON.stringify([store.get(s.id), store.read('fixture', 'secret'), store.events(s.id)]),
    ).not.toContain(secret);
    expect(readFileSync(path, 'utf8')).toBe('[REDACTED]');
    expect(() => new Approvals(store).request(s.id, 'comment', { comment: secret })).toThrow(
      'secret',
    );
  } finally {
    store.close();
    f.cleanup();
  }
});
it('disables repository-created hooks and rejects executable local Git configuration', async () => {
  const repo = await gitFixture();
  try {
    mkdirSync(repo.root + '/.mergepilot-disabled-hooks');
    writeFileSync(
      repo.root + '/.mergepilot-disabled-hooks/pre-commit',
      '#!/bin/sh\necho injected > hook-ran\n',
      { mode: 0o700 },
    );
    writeFileSync(repo.root + '/README.md', 'changed\n');
    await git(repo.root, ['add', 'README.md']);
    await git(repo.root, ['commit', '-m', 'controlled commit']);
    expect(existsSync(repo.root + '/hook-ran')).toBe(false);
    await repo.git('config', 'core.fsmonitor', 'malicious-helper');
    await expect(git(repo.root, ['status', '--porcelain'])).rejects.toThrow(
      'Unsafe repository Git configuration',
    );
    await repo.git('config', '--unset', 'core.fsmonitor');
    await repo.git('config', 'url.https://example.invalid/.insteadOf', 'https://github.com/');
    await expect(git(repo.root, ['rev-parse', 'HEAD'])).rejects.toThrow('Unsafe');
  } finally {
    repo.cleanup();
  }
});
it('refuses external Git pointers and state/artifact/tenant symlinks', async () => {
  const f = fixture({ '.git': 'gitdir: /tmp/outside\n' }),
    outside = fixture(),
    store = new Store(f.root);
  try {
    await expect(git(f.root, ['status'])).rejects.toThrow('external Git metadata');
    const s = store.create(PreferencesSchema.parse({}));
    const linkType = process.platform === 'win32' ? 'junction' : 'dir';
    symlinkSync(outside.root, f.root + '/artifacts', linkType);
    expect(() => store.artifact(s.id, 'outside.log', 'no')).toThrow('Symbolic links');
    expect(existsSync(outside.root + '/outside.log')).toBe(false);
    symlinkSync(outside.root, f.root + '/tenants', linkType);
    const service = new HttpService(store);
    expect(() => service.tenant('other')).toThrow('Symbolic links');
    await service.close();
  } finally {
    store.close();
    f.cleanup();
    outside.cleanup();
  }
});
it('retains user skips and applies only explicitly relaxed search filters', async () => {
  const f = fixture(),
    store = new Store(f.root),
    repo = repository();
  let query = '';
  const client = new GitHubClient(
    { kind: 'token', token: async () => 'fixture' },
    async (input) => {
      query = new URL(String(input)).searchParams.get('q') ?? '';
      return new Response(JSON.stringify({ items: [raw(1), raw(2)], incomplete_results: false }), {
        headers: { 'content-type': 'application/json' },
      });
    },
  );
  const engine = new DiscoveryEngine(client, store),
    verified = vi
      .spyOn(engine, 'verify')
      .mockImplementation(async (_repo, n, _signal, relaxed) => ({
        ...mapIssue(repo, raw(n)),
        eligibility: 'ELIGIBLE',
        officialProvenance: 'ELIGIBLE',
        repositoryPolicy: 'ALLOWED',
        competingPRScanComplete: true,
        reserved: false,
        confidence: 'high',
        body: 'Regression test fails with steps to reproduce. Expected behavior differs.',
        rejectReasons: relaxed?.includes('comments') ? [] : ['fixture'],
      }));
  try {
    const s = store.create(PreferencesSchema.parse({}));
    store.mutate(s.id, (x) => {
      x.selectedIssue = mapIssue(repo, raw());
    });
    new SessionControls(store).skip(s.id);
    expect(store.read('skipped-issues', s.id)).toEqual([raw().html_url]);
    const skipped = store.read<string[]>('skipped-issues', s.id)!;
    const result = await engine.find([repo], s.preferences, undefined, ['comments'], skipped);
    expect(result.candidates.map((i) => i.issueNumber)).toEqual([2]);
    expect(verified).toHaveBeenCalledWith(repo, 2, undefined, ['comments']);
    expect(query).not.toContain('comments:0');
    expect(query).toContain('no:assignee');
  } finally {
    store.close();
    f.cleanup();
  }
});
it('replays an interrupted webhook and rejects reuse of its delivery identity', () => {
  const f = fixture(),
    store = new Store(f.root),
    secret = 'webhook-test-secret-'.repeat(3),
    s = store.create(PreferencesSchema.parse({}));
  store.mutate(s.id, (x) => {
    x.repository = repository();
    x.publishApproved = true;
  });
  const raw = Buffer.from(
      JSON.stringify({
        installation: { id: 42 },
        repository: { id: 1, full_name: 'o/r', private: false },
      }),
    ),
    signature = 'sha256=' + createHmac('sha256', secret).update(raw).digest('hex'),
    delivery = randomUUID(),
    receiver = new WebhookReceiver(store, secret, 42),
    event = vi.spyOn(store, 'event');
  try {
    event.mockImplementationOnce(() => {
      throw new Error('simulated interruption');
    });
    expect(() => receiver.receive(raw, 'issues', signature, delivery)).toThrow('interruption');
    event.mockRestore();
    expect(receiver.receive(raw, 'issues', signature, delivery)).toMatchObject({
      duplicate: false,
      affected: 1,
    });
    expect(receiver.receive(raw, 'issues', signature, delivery).duplicate).toBe(true);
    expect(() => receiver.receive(raw, 'push', signature, delivery)).toThrow('identity');
    expect(store.get(s.id).publishApproved).toBe(false);
  } finally {
    event.mockRestore();
    store.close();
    f.cleanup();
  }
});
it('rejects expired approval and records silent tests as unavailable', async () => {
  const repo = await gitFixture(),
    f = fixture(),
    store = new Store(f.root);
  try {
    const s = store.create(PreferencesSchema.parse({})),
      approvals = new Approvals(store),
      request = approvals.request(s.id, 'review', { reviewers: ['o'] });
    store.put('approvals', request.id, { ...request, expiresAt: Date.now() - 1 });
    await expect(approvals.confirmFromHuman(request.id)).rejects.toThrow('expired');
    const command = CommandSchema.parse({
      id: 'silent',
      name: 'silent test fixture',
      kind: 'test',
      executable: 'git',
      args: ['rev-parse', '--is-inside-work-tree', '--quiet'],
      cwd: repo.root,
      source: 'controlled fixture',
    });
    command.args = ['diff', '--quiet'];
    store.mutate(s.id, (x) => {
      x.workspace = repo.root;
      x.commands = [command];
    });
    const run = await executeCheck(store, s.id, command.id, {
      source: 'host-approved-execution',
      network: false,
    });
    expect(run.check.status).toBe('UNAVAILABLE');
    expect(run.check.explanation).toContain('no verifiable output');
    const timed = await runProcess({
      ...command,
      executable: 'python3',
      args: ['-c', 'import time; print("started",flush=True); time.sleep(20)'],
      timeoutMs: 50,
    });
    expect(timed.cancelled).toBe(true);
    expect(timed.reason).toBe('Command timed out');
  } finally {
    store.close();
    f.cleanup();
    repo.cleanup();
  }
});
it('does not count skipped CI as passing CI', () => {
  const f = fixture(),
    store = new Store(f.root);
  try {
    const s = store.create(PreferencesSchema.parse({}));
    store.put('monitor', s.id, { complete: true, ci: [{ status: 'skipped' }], feedback: [] });
    expect(summarize(store, s).milestones.ci_passing).toBe(false);
  } finally {
    store.close();
    f.cleanup();
  }
});
