import { test, expect } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, extname } from 'node:path';
const root = resolve('dashboard/dist');
const session = {
  id: '11111111-1111-4111-8111-111111111111',
  state: 'BLOCKED',
  source: 'local',
  updatedAt: '2026-10-26T00:00:00.000Z',
  repository: {
    name: 'fixture/project',
    url: 'https://github.com/fixture/project',
    forge: 'github',
  },
  issue: {
    number: 12,
    title: 'Preserve pagination filters',
    url: 'https://github.com/fixture/project/issues/12',
    eligibility: 'ELIGIBLE',
    confidence: 'high',
    checkedAt: '2026-10-26T00:00:00.000Z',
    score: 87,
    discussionComments: 0,
    assignees: [],
    author: 'maintainer',
    provenance: 'ELIGIBLE',
    linkedPRs: [],
  },
  policy: 'ALLOWED',
  checks: [{ name: 'Regression tests', status: 'UNAVAILABLE', verified: true }],
  blockers: ['Compiler unavailable'],
  milestones: { verified: true },
  rejectionCounts: { 'Issue has discussion comments': 3 },
  relaxations: [],
  evidence: [],
  candidates: [],
};
test('connects filters inspects and disconnects without storing the token', async ({
  page,
}, info) => {
  expect(
    existsSync(root + '/index.html'),
    'Build the dashboard before running browser checks',
  ).toBe(true);
  let authenticated = false;
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(error.message));
  await page.route('http://mergepilot.test/**', async (route) => {
    const url = new URL(route.request().url()),
      path = url.pathname;
    if (path.startsWith('/api/')) {
      let value: unknown,
        status = 200;
      if (path === '/api/login') {
        authenticated = route.request().postDataJSON().token === 'test-dashboard-token';
        value = { principal: 'local', scopes: ['read'], csrf: 'test-csrf' };
        if (!authenticated) status = 401;
      } else if (path === '/api/logout') {
        authenticated = false;
        value = { loggedOut: true };
      } else if (!authenticated) {
        status = 401;
        value = { error: 'Authentication required' };
      } else if (path === '/api/profile')
        value = { principal: 'local', scopes: ['read'], csrf: 'test-csrf' };
      else if (path === '/api/sessions') value = { sessions: [session], nextOffset: null };
      else
        value = {
          sessions: 1,
          local: 1,
          synced: 0,
          funnel: { verified: 1 },
          rejections: session.rejectionCounts,
          notice: 'Fixture metadata for UI verification.',
        };
      await route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(value),
      });
      return;
    }
    const file = resolve(root, path === '/' ? 'index.html' : path.slice(1));
    if (!file.startsWith(root + '/') || !existsSync(file)) {
      await route.fulfill({ status: 404, body: 'Not found' });
      return;
    }
    const types: Record<string, string> = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
    };
    await route.fulfill({
      contentType: types[extname(file)] ?? 'application/octet-stream',
      body: readFileSync(file),
    });
  });
  await page.goto('http://mergepilot.test/');
  await page.getByLabel('Dashboard access token').fill('test-dashboard-token');
  await page.getByRole('button', { name: 'Connect to your journal' }).click();
  await expect(page.getByRole('heading', { name: 'Contribution journal' })).toBeVisible();
  await page.getByLabel('Search contributions').fill('nothing matches');
  await expect(page.getByText('No matching contributions')).toBeVisible();
  await page.getByLabel('Search contributions').fill('');
  await page.getByRole('button', { name: /fixture\/project/ }).click();
  await expect(page.getByRole('region', { name: 'Selected contribution' })).toBeVisible();
  await expect(page.getByText('Compiler unavailable')).toBeVisible();
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  await page.screenshot({
    path: info.outputPath('dashboard.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Disconnect' }).click();
  await expect(page.getByLabel('Dashboard access token')).toBeVisible();
  expect(failures).toEqual([]);
});
