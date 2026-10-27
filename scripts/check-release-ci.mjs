import { setTimeout as delay } from 'node:timers/promises';

const repository = process.env.GITHUB_REPOSITORY;
const sha = process.env.GITHUB_SHA;
if (!/^[\w.-]+\/[\w.-]+$/.test(repository ?? '') || !/^[a-f0-9]{40}$/.test(sha ?? ''))
  throw new Error('Expected GitHub repository and exact source commit');
if (!process.env.GH_TOKEN) throw new Error('GitHub Actions read credential is missing');
const deadline = Date.now() + 10 * 60 * 1000;
while (true) {
  const response = await fetch(
    `https://api.github.com/repos/${repository}/actions/workflows/ci.yml/runs?head_sha=${sha}&per_page=10`,
    {
      headers: {
        authorization: 'Bearer ' + process.env.GH_TOKEN,
        accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: AbortSignal.timeout(30000),
    },
  );
  if (!response.ok) throw new Error('Cannot verify release CI: HTTP ' + response.status);
  const data = await response.json();
  const latest = data.workflow_runs
    ?.filter((run) => run.head_sha === sha && ['push', 'workflow_dispatch'].includes(run.event))
    .sort((a, b) => b.id - a.id)[0];
  if (latest?.status === 'completed') {
    if (latest.conclusion !== 'success')
      throw new Error(
        'The complete verify workflow failed on this exact commit; publishing is blocked',
      );
    console.log(
      JSON.stringify({
        sourceCommit: sha,
        qualificationRun: latest.html_url,
        conclusion: latest.conclusion,
      }),
    );
    break;
  }
  if (Date.now() >= deadline)
    throw new Error(
      'Timed out waiting for complete CI on this exact commit; publishing is blocked',
    );
  console.log('Waiting for complete CI on source commit ' + sha);
  await delay(15000);
}
