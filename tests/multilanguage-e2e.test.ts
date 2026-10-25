import { it, expect, vi } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { Store } from '../src/state/store.js';
import { createApplication } from '../src/mcp/bootstrap.js';
import { executeCheck } from '../src/execution/runner.js';
import { inspectPatch } from '../src/contribution/quality.js';
import { executableAvailable } from '../src/languages/environment.js';
import { fixture, gitFixture } from './helpers.js';

interface Example {
  ecosystem: string;
  tools: string[];
  files: Record<string, string>;
  fix: Record<string, string>;
}
const examples = JSON.parse(
  readFileSync(new URL('../examples/dry-run-fixtures.json', import.meta.url), 'utf8'),
) as Example[];
for (const example of examples)
  it(
    `completes a native ${example.ecosystem} contribution dry run with a failing baseline`,
    async (context) => {
      if (!['sh', ...example.tools].every((tool) => executableAvailable(tool, process.cwd()))) {
        context.skip();
        return;
      }
      const repo = await gitFixture(example.files),
        data = fixture(),
        store = new Store(data.root);
      try {
        const sha = await repo.git('rev-parse', 'HEAD'),
          owners = ['fixture-a', 'fixture-b'];
        let writes = 0;
        const metadata = (owner: string) => ({
          id: owner === 'fixture-a' ? 1 : 2,
          full_name: owner + '/demo',
          html_url: `https://github.com/${owner}/demo`,
          clone_url: `https://github.com/${owner}/demo.git`,
          default_branch: 'main',
          private: false,
          archived: false,
          fork: false,
          has_issues: true,
          language: example.ecosystem,
          stargazers_count: 30,
          pushed_at: new Date().toISOString(),
          owner: { login: owner, type: 'User' },
        });
        const issue = (owner: string) => ({
          number: 1,
          title: 'Increment returns unchanged value',
          body: 'Steps to reproduce: run the regression test. Expected: increment the input. Actual: unchanged value.',
          html_url: `https://github.com/${owner}/demo/issues/1`,
          state: 'open',
          comments: 0,
          assignees: [],
          user: { login: owner },
          author_association: 'OWNER',
          labels: [],
        });
        vi.stubGlobal('fetch', async (input: URL | RequestInfo, init?: RequestInit) => {
          const url = new URL(
              typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
            ),
            path = decodeURIComponent(url.pathname),
            owner = path.split('/')[2]!,
            send = (value: unknown, status = 200) =>
              new Response(JSON.stringify(value), {
                status,
                headers: { 'content-type': 'application/json' },
              });
          if (init?.method && init.method !== 'GET' && path !== '/graphql') {
            writes++;
            throw new Error('Dry run attempted a public write');
          }
          if (path === '/search/repositories')
            return send({ items: owners.map(metadata), incomplete_results: false });
          if (path === '/search/issues') {
            const q = url.searchParams.get('q') ?? '';
            if (q.includes('is:pr')) return send({ items: [], incomplete_results: false });
            const match = q.match(/repo:([^/]+)\//);
            return send({
              items: match
                ? [issue(match[1]!)]
                : owners.map((owner) => ({
                    repository_url: `https://api.github.com/repos/${owner}/demo`,
                  })),
              incomplete_results: false,
            });
          }
          if (
            path === '/graphql' &&
            String(JSON.parse(String(init?.body)).query).includes('projectItems')
          )
            return send({
              data: {
                repository: {
                  issue: { projectItems: { nodes: [], pageInfo: { hasNextPage: false } } },
                },
              },
            });
          if (path.endsWith('/releases/latest')) return send({ message: 'No release' }, 404);
          if (path.endsWith('/branches')) return send([]);
          if (path === '/graphql')
            return send({
              data: {
                repository: {
                  issue: { timelineItems: { nodes: [], pageInfo: { hasNextPage: false } } },
                },
              },
            });
          if (path.includes('/.github/')) return send({ message: 'missing' }, 404);
          if (/^\/repos\/[^/]+\/demo$/.test(path)) return send(metadata(owner));
          if (path.endsWith('/languages')) return send({ [example.ecosystem]: 100 });
          if (path.endsWith('/commits/main')) return send({ sha });
          if (path.includes('/git/trees/'))
            return send({
              tree: Object.keys(example.files).map((path) => ({ path, type: 'blob' })),
              truncated: false,
            });
          if (path.includes('/contents/')) {
            const file = path.split('/contents/')[1]!,
              text = example.files[file];
            return text === undefined
              ? send({}, 404)
              : send({
                  content: Buffer.from(text).toString('base64'),
                  encoding: 'base64',
                  sha: 'fixture-' + file,
                  html_url: `https://github.com/${owner}/demo/blob/${sha}/${file}`,
                  size: text.length,
                });
          }
          if (path.endsWith('/issues/1')) return send(issue(owner));
          if (path.endsWith('/issues/1/timeline')) return send([]);
          if (path.endsWith('/pulls'))
            return send(
              Array.from({ length: 5 }, (_, i) => ({
                number: i + 10,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                closed_at: new Date().toISOString(),
                merged_at: new Date().toISOString(),
                author_association: 'OWNER',
              })),
            );
          if (path.endsWith('/reviews')) return send([{ submitted_at: new Date().toISOString() }]);
          throw new Error('Unexpected fixture API request: ' + path);
        });
        vi.stubEnv('MERGEPILOT_GITHUB_TOKEN', 'controlled-native-fixture');
        vi.stubEnv('MERGEPILOT_FORGES', '[]');
        const app = createApplication(store, {
            workspaceFactory: async () => ({ root: repo.root, sha }),
          }),
          start = (await app.callTool('start_contribution', {
            preferences: { languages: [example.ecosystem], difficulty: 'small' },
            dryRun: true,
          })) as { sessionId: string },
          id = start.sessionId;
        await app.callTool('discover_repositories', { sessionId: id });
        expect(store.get(id).repositories.length).toBeGreaterThan(1);
        await app.callTool('find_eligible_issues', { sessionId: id });
        expect(store.get(id).selectedIssue?.eligibility).toBe('ELIGIBLE');
        await app.callTool('analyze_repository', { sessionId: id });
        await app.callTool('record_analysis', {
          sessionId: id,
          analysis: {
            expected: 'Increment input by one',
            actual: 'Returns unchanged input',
            rootCause: 'Missing addition in increment',
            strategy: 'Add the missing increment with existing focused regression coverage',
            files: Object.keys(example.fix),
            evidenceUrls: Object.keys(example.fix).concat('test.sh'),
            reproduced: true,
            reproductionExplanation: 'Native baseline regression fails with the unfixed source',
            highRisk: false,
          },
        });
        await app.callTool('plan_fix', { sessionId: id });
        await app.callTool('get_execution_plan', { sessionId: id });
        const command = store.get(id).commands.find((c) => c.kind === 'test')!;
        expect(command).toBeDefined();
        const baseline = await executeCheck(store, id, command.id, {
          source: 'host-approved-execution',
          network: false,
        });
        expect(baseline.check.status).toBe('FAIL');
        for (const [file, text] of Object.entries(example.fix))
          writeFileSync(repo.root + '/' + file, text);
        const passing = await executeCheck(store, id, command.id, {
          source: 'host-approved-execution',
          network: false,
        });
        expect(passing.check.status).toBe('PASS');
        expect(readFileSync(passing.check.outputPath!, 'utf8')).toContain(
          'regression checks passed',
        );
        await app.callTool('record_check_result', { sessionId: id, executionIds: [passing.id] });
        const inspection = await inspectPatch(store.get(id));
        await app.callTool('check_patch', {
          sessionId: id,
          critique: {
            patchHash: inspection.patchHash,
            findings: [],
            reviewedAt: new Date().toISOString(),
            reviewer: 'independent fixture diff inspection',
          },
        });
        await app.callTool('prepare_pull_request', {
          sessionId: id,
          proposal: {
            actor: 'fixture-user',
            authorName: 'Fixture User',
            authorEmail: 'fixture@example.invalid',
            title: 'Correct increment behavior',
          },
        });
        const preview = (await app.callTool('publish_pull_request', { sessionId: id })) as {
          dryRun: boolean;
        };
        expect(preview.dryRun).toBe(true);
        expect(writes).toBe(0);
        if (process.env.MERGEPILOT_EVIDENCE_DIR) {
          const target = process.env.MERGEPILOT_EVIDENCE_DIR;
          mkdirSync(target, { recursive: true });
          writeFileSync(
            join(target, example.ecosystem.toLowerCase() + '.json'),
            JSON.stringify(
              {
                ecosystem: example.ecosystem,
                checkedAt: new Date().toISOString(),
                forge: 'controlled fixture responses',
                command: { executable: command.executable, args: command.args },
                baseline: {
                  status: baseline.check.status,
                  exitCode: baseline.check.exitCode,
                  output: readFileSync(baseline.check.outputPath!, 'utf8').replaceAll(
                    repo.root,
                    '<workspace>',
                  ),
                  capturedOutputHash: baseline.check.outputHash,
                  normalizedOutputHash: createHash('sha256')
                    .update(
                      readFileSync(baseline.check.outputPath!, 'utf8').replaceAll(
                        repo.root,
                        '<workspace>',
                      ),
                    )
                    .digest('hex'),
                },
                fixed: {
                  status: passing.check.status,
                  exitCode: passing.check.exitCode,
                  output: readFileSync(passing.check.outputPath!, 'utf8').replaceAll(
                    repo.root,
                    '<workspace>',
                  ),
                  capturedOutputHash: passing.check.outputHash,
                  normalizedOutputHash: createHash('sha256')
                    .update(
                      readFileSync(passing.check.outputPath!, 'utf8').replaceAll(
                        repo.root,
                        '<workspace>',
                      ),
                    )
                    .digest('hex'),
                },
                stages: [
                  'discovered',
                  'verified',
                  'reproduced',
                  'implemented',
                  'tested',
                  'PR prepared',
                  'dry-run preview',
                ],
                publicWrites: writes,
              },
              null,
              2,
            ) + '\n',
          );
        }
        console.log(
          `${example.ecosystem}: FAIL baseline -> PASS regression -> PR dry-run preview; zero public writes`,
        );
      } finally {
        vi.unstubAllGlobals();
        vi.unstubAllEnvs();
        store.close();
        data.cleanup();
        repo.cleanup();
      }
    },
    process.platform === 'win32' ? 60000 : 30000,
  );
