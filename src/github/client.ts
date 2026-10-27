import { Octokit } from '@octokit/core';
import type { Credentials } from './auth.js';
import { SearchBudget } from '../discovery/budget.js';
import { VERSION } from '../index.js';
export class ForgeError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAt?: number,
  ) {
    super(message);
  }
}
export class GitHubClient {
  requests = 0;
  private budget = new SearchBudget();
  constructor(
    private auth: Credentials,
    private fetcher: typeof fetch = fetch,
    private pause: (ms: number) => Promise<void> = (ms) =>
      new Promise((resolve) => setTimeout(resolve, ms)),
  ) {}
  async request<T>(
    method: string,
    path: string,
    params: Record<string, unknown> = {},
    signal?: AbortSignal,
  ): Promise<T> {
    if (!path.startsWith('/') || path.startsWith('//') || path.includes('://'))
      throw new Error('Only GitHub API relative paths are accepted');
    const octokit = new Octokit({
      auth: await this.auth.token(),
      request: { fetch: this.fetcher },
      userAgent: `contribolt/${VERSION}`,
    });
    for (let attempt = 0; ; attempt++) {
      this.budget.take(signal);
      this.requests++;
      try {
        const response = await octokit.request({
          method,
          url: path,
          ...params,
          headers: { accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2026-03-10' },
          request: {
            signal: signal
              ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
              : AbortSignal.timeout(15000),
          },
        });
        return response.data as T;
      } catch (error) {
        const e = error as { status?: number; response?: { headers?: Record<string, string> } };
        const status = e.status ?? 0,
          headers = e.response?.headers ?? {};
        if (signal?.aborted) throw signal.reason;
        const limited =
          status === 429 ||
          (status === 403 &&
            (headers['x-ratelimit-remaining'] === '0' || !!headers['retry-after']));
        if (limited) {
          const delay = headers['retry-after']
            ? Number(headers['retry-after']) * 1000
            : Math.max(1000, Number(headers['x-ratelimit-reset'] ?? 0) * 1000 - Date.now());
          throw new ForgeError(
            'GitHub rate limit reached; session can resume after reset',
            status,
            Date.now() + delay,
          );
        }
        if (method === 'GET' && attempt < 2 && (status === 0 || status >= 500)) {
          await this.pause(250 * 2 ** attempt);
          continue;
        }
        throw new ForgeError(
          status === 401
            ? 'GitHub credentials rejected'
            : status === 403
              ? 'GitHub operation not permitted'
              : `GitHub request failed (${status || 'network unavailable'})`,
          status,
        );
      }
    }
  }
  async pages<T>(
    path: string,
    params: Record<string, unknown> = {},
    limit = 1000,
    signal?: AbortSignal,
  ): Promise<{ items: T[]; complete: boolean }> {
    const items: T[] = [];
    for (let page = 1; items.length < limit; page++) {
      const response = await this.request<T[] | { items: T[]; incomplete_results?: boolean }>(
        'GET',
        path,
        { ...params, per_page: 100, page },
        signal,
      );
      const values = Array.isArray(response) ? response : response.items;
      if (!Array.isArray(values)) throw new Error('Invalid paginated GitHub response');
      const remaining = limit - items.length;
      items.push(...values.slice(0, remaining));
      if (!Array.isArray(response) && response.incomplete_results)
        return { items, complete: false };
      if (values.length > remaining) return { items, complete: false };
      if (values.length < 100) return { items, complete: true };
    }
    return { items, complete: false };
  }
  async graphql<T>(
    query: string,
    variables: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<T> {
    const response = await this.request<{ data?: T; errors?: unknown[] }>(
      'POST',
      '/graphql',
      { query, variables },
      signal,
    );
    if (response.errors?.length || !response.data)
      throw new ForgeError('GraphQL evidence is incomplete', 422);
    return response.data;
  }
}
