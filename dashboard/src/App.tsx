import { useEffect, useState, useRef, type FormEvent } from 'react';
import type { SessionSummary } from '../../src/http/metadata.js';
type Metrics = {
  sessions: number;
  local: number;
  synced: number;
  funnel: Record<string, number>;
  rejections: Record<string, number>;
  notice: string;
};
type Profile = { principal: string; scopes: string[]; csrf?: string };
const empty: Metrics = {
  sessions: 0,
  local: 0,
  synced: 0,
  funnel: {},
  rejections: {},
  notice: '',
};
const stageLabels: Record<string, string> = {
  ONBOARDING: 'Preferences',
  REPOSITORY_DISCOVERY: 'Finding projects',
  ISSUE_DISCOVERY: 'Finding issues',
  ELIGIBILITY_VERIFICATION: 'Verifying',
  PROJECT_POLICY_GATE: 'Checking policy',
  REPOSITORY_ANALYSIS: 'Investigating',
  ISSUE_REPRODUCTION: 'Reproducing',
  IMPLEMENTATION_PLAN: 'Planning',
  PATCH_IMPLEMENTATION: 'Implementing',
  VALIDATION: 'Validating',
  PRE_SUBMISSION_RECHECK: 'Preparing PR',
  USER_APPROVAL_TO_PUBLISH: 'Awaiting approval',
  FORK_BRANCH_PUSH_PR: 'Publishing',
  REVIEW_ROUTING: 'Review routing',
  REVIEW_MONITORING: 'In review',
  REVISIONS_IF_NEEDED: 'Revisions needed',
  DONE: 'Complete',
  BLOCKED: 'Blocked',
  SKIPPED: 'Skipped',
  FAILED: 'Failed',
};
const date = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
const label = (s: SessionSummary) =>
  s.outcome === 'merged'
    ? 'Merged'
    : s.outcome === 'closed_without_merge'
      ? 'Closed without merge'
      : (stageLabels[s.state] ?? s.state);
const tone = (value: string) => {
  const normalized = value.toUpperCase();
  return /PASS|ALLOWED|ELIGIBLE|MERGED/.test(normalized) &&
    !/FAIL|INELIGIBLE|UNAVAILABLE/.test(normalized)
    ? 'positive'
    : /FAIL|BLOCKED|PROHIBITED|INELIGIBLE|UNKNOWN|UNAVAILABLE|REVISIONS/.test(normalized)
      ? 'attention'
      : 'neutral';
};
async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!response.ok)
    throw new Error(
      response.status === 401
        ? 'Your dashboard session expired. Connect again.'
        : `Request failed (${response.status}).`,
    );
  return response.json() as Promise<T>;
}
function Mark() {
  return (
    <span className="mark" aria-hidden="true">
      <svg viewBox="0 0 32 32">
        <path
          d="M6 7h9v8h11M15 7l8 8-8 10M6 25h9"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
function Badge({ value }: { value: string }) {
  return <span className={'badge ' + tone(value)}>{value.replaceAll('_', ' ')}</span>;
}
export function ContributionDashboard({
  sessions,
  metrics,
  onSelect,
  selectedId,
}: {
  sessions: SessionSummary[];
  metrics: Metrics;
  onSelect: (id: string) => void;
  selectedId?: string;
}) {
  const [search, setSearch] = useState(''),
    [filter, setFilter] = useState('all');
  const filtered = sessions.filter(
    (s) =>
      (s.repository?.name + ' ' + s.issue?.title + ' ' + label(s))
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (filter === 'all' ||
        (filter === 'attention' &&
          ['BLOCKED', 'FAILED', 'REVISIONS_IF_NEEDED'].includes(s.state)) ||
        (filter === 'published' && !!s.prUrl) ||
        (filter === 'merged' && s.outcome === 'merged')),
  );
  const cards = [
    ['Sessions', String(metrics.sessions), 'Started contributions'],
    [
      'Eligible issues',
      String(metrics.funnel.verified ?? 0),
      'Evidence checked at the recorded time',
    ],
    ['Test evidence', String(metrics.funnel.tested ?? 0), 'At least one captured test pass'],
    ['PRs opened', String(metrics.funnel.pr_opened ?? 0), 'Confirmed publication outcomes'],
    ['Merged', String(metrics.funnel.merged ?? 0), 'Observed merges, never guaranteed'],
  ];
  return (
    <>
      <section className="metrics" aria-label="Contribution metrics">
        {cards.map(([title, value, description]) => (
          <article className="metric" key={title}>
            <p>{title}</p>
            <strong>{value}</strong>
            <small>{description}</small>
          </article>
        ))}
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">YOUR WORK</p>
            <h2>Contribution journal</h2>
          </div>
          <span className="muted">
            {metrics.local} local · {metrics.synced} synced
          </span>
        </div>
        <div className="filters">
          <label className="search-label">
            Search contributions
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Repository or issue title"
            />
          </label>
          <label>
            Show
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All sessions</option>
              <option value="attention">Needs attention</option>
              <option value="published">PR opened</option>
              <option value="merged">Merged</option>
            </select>
          </label>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Project & issue</th>
                <th scope="col">Stage</th>
                <th scope="col">Checks</th>
                <th scope="col">Updated</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className={s.id === selectedId ? 'selected' : ''}>
                  <td>
                    <button
                      className="session-button"
                      onClick={() => onSelect(s.id)}
                      aria-expanded={selectedId === s.id}
                    >
                      <strong>{s.repository?.name ?? 'Choosing a project'}</strong>
                      <span>
                        {s.issue
                          ? `#${s.issue.number} · ${s.issue.title}`
                          : 'Preferences and discovery'}
                      </span>
                    </button>
                    <small className="source">
                      {s.source === 'synced' ? 'Device-reported metadata' : 'Local session'}
                      {s.relaxations.length ? ' · Authorized filter exceptions' : ''}
                    </small>
                  </td>
                  <td>
                    <Badge value={label(s)} />
                  </td>
                  <td>
                    {s.checks.length ? (
                      <span>
                        {s.checks.filter((c) => c.status === 'PASS' && c.verified).length}/
                        {s.checks.length} recorded passes
                      </span>
                    ) : (
                      <span className="muted">Not run</span>
                    )}
                  </td>
                  <td className="muted">{date(s.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && (
          <div className="empty">
            <span aria-hidden="true">↗</span>
            <h3>
              {sessions.length
                ? 'No matching contributions'
                : 'Your next contribution starts in your coding CLI'}
            </h3>
            <p>
              {sessions.length
                ? 'Try another search or filter.'
                : 'Ask your agent to find an open-source contribution. Verified evidence and progress will appear here.'}
            </p>
          </div>
        )}
      </section>
    </>
  );
}
export function SessionDetail({
  session: s,
  onClose,
}: {
  session: SessionSummary;
  onClose: () => void;
}) {
  return (
    <section className="panel detail" aria-label="Selected contribution">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">SESSION DETAILS</p>
          <h2>{s.issue?.title ?? 'Contribution in progress'}</h2>
          <p className="muted">{s.repository?.name ?? s.id}</p>
        </div>
        <button className="quiet" onClick={onClose}>
          Close details
        </button>
      </div>
      <div className="detail-grid">
        <div>
          <h3>Current state</h3>
          <Badge value={label(s)} />
          <p className="muted">
            {s.source === 'synced'
              ? 'Reported by a synced device.'
              : 'Read from the local session ledger.'}
          </p>
          {s.prUrl && (
            <a href={s.prUrl} target="_blank" rel="noopener noreferrer">
              Open pull request ↗
            </a>
          )}
          <h3>Contribution policy</h3>
          <Badge value={s.policy} />
          {s.relaxations.length > 0 && (
            <p className="attention-text">
              Authorized exceptions: {s.relaxations.join(', ')}. These are outside the default
              strict filters.
            </p>
          )}
        </div>
        <div>
          <h3>Issue evidence</h3>
          {s.issue ? (
            <>
              <a href={s.issue.url} target="_blank" rel="noopener noreferrer">
                Issue #{s.issue.number} ↗
              </a>
              <dl>
                <dt>Verdict</dt>
                <dd>{s.issue.eligibility}</dd>
                <dt>Confidence</dt>
                <dd>{s.issue.confidence}</dd>
                <dt>Score</dt>
                <dd>
                  {s.issue.score ?? 'Not scored'} <small>(heuristic)</small>
                </dd>
                <dt>Discussion comments</dt>
                <dd>{s.issue.discussionComments ?? 'Unknown'}</dd>
                <dt>Assignees</dt>
                <dd>
                  {s.issue.assignees === undefined
                    ? 'Unknown'
                    : s.issue.assignees.join(', ') || 'None'}
                </dd>
                <dt>Author provenance</dt>
                <dd>{s.issue.provenance ?? 'Unknown'}</dd>
                <dt>Checked</dt>
                <dd>{date(s.issue.checkedAt)}</dd>
              </dl>
              <p className="muted">
                No known competing PR is an observation at a point in time, rather than a claim of
                exclusive ownership.
              </p>
            </>
          ) : (
            <p className="muted">An issue has not been selected.</p>
          )}
        </div>
      </div>
      {s.blockers.length > 0 && (
        <div className="callout">
          <h3>Needs attention</h3>
          <ul>
            {s.blockers.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </div>
      )}
      <h3>Validation</h3>
      {s.checks.length ? (
        <div className="check-list">
          {s.checks.map((c, i) => (
            <div className="check" key={i}>
              <span>{c.name}</span>
              <Badge value={c.status} />
              <small>
                {s.source === 'synced'
                  ? 'Device-reported'
                  : c.verified
                    ? 'Captured execution'
                    : 'Unverified report'}
              </small>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">No execution results are recorded.</p>
      )}
      {s.evidence.length > 0 && (
        <>
          <h3>Source observations</h3>
          <ul className="evidence">
            {s.evidence.map((e, i) => (
              <li key={i}>
                <a href={e.url} target="_blank" rel="noopener noreferrer">
                  {e.observation}
                </a>
                <small>
                  {date(e.checkedAt)} · {e.complete ? 'Source read' : 'Incomplete evidence'}
                </small>
              </li>
            ))}
          </ul>
        </>
      )}
      {s.candidates.length > 0 && (
        <details>
          <summary>Candidate decisions ({s.candidates.length})</summary>
          <ul className="evidence">
            {s.candidates.map((c) => (
              <li key={c.url}>
                <a href={c.url} target="_blank" rel="noopener noreferrer">
                  {c.title}
                </a>
                <small>
                  {c.eligibility}
                  {c.score !== undefined ? ' · ' + c.score + '/100' : ''}
                </small>
                {c.reasons.length > 0 && <p>{c.reasons.join('; ')}</p>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
export function App() {
  const [profile, setProfile] = useState<Profile | null>(null),
    [token, setToken] = useState(''),
    [sessions, setSessions] = useState<SessionSummary[]>([]),
    [metrics, setMetrics] = useState<Metrics>(empty),
    [selected, setSelected] = useState<string>(),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [updated, setUpdated] = useState('');
  const identity = useRef<string | null>(null);
  const refresh = async () => {
    const principal = identity.current;
    setLoading(true);
    try {
      const [list, statistics] = await Promise.all([
        api<{ sessions: SessionSummary[] }>('/api/sessions'),
        api<Metrics>('/api/metrics'),
      ]);
      if (identity.current !== principal) return;
      setSessions(list.sessions);
      setMetrics(statistics);
      setUpdated(new Date().toISOString());
      setError('');
    } catch (err) {
      if (identity.current === principal)
        setError(String(err instanceof Error ? err.message : err));
    } finally {
      if (identity.current === principal) setLoading(false);
    }
  };
  useEffect(() => {
    let cancelled = false;
    api<Profile>('/api/profile')
      .then((p) => {
        if (!cancelled) {
          identity.current = p.principal;
          setProfile(p);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (!profile) return;
    void refresh();
    const interval = setInterval(() => {
      void refresh();
    }, 30000);
    return () => clearInterval(interval);
  }, [profile]);
  const login = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const p = await api<Profile>('/api/login', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      setToken('');
      setSessions([]);
      setMetrics(empty);
      identity.current = p.principal;
      setProfile(p);
    } catch {
      setError('The dashboard access token could not be verified.');
    } finally {
      setLoading(false);
    }
  };
  const logout = async () => {
    identity.current = null;
    try {
      await api('/api/logout', {
        method: 'POST',
        headers: { 'x-mergepilot-csrf': profile?.csrf ?? '' },
        body: '{}',
      });
    } finally {
      setProfile(null);
      setSessions([]);
      setMetrics(empty);
      setSelected(undefined);
    }
  };
  const active = sessions.find((s) => s.id === selected),
    rejections = Object.entries(metrics.rejections)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header>
        <div className="brand">
          <Mark />
          <span>MergePilot</span>
          <span className="brand-caption">CONTRIBUTION WORKSPACE</span>
        </div>
        <div className="header-actions">
          <span className="readonly">Read-only dashboard</span>
          {profile && (
            <button onClick={() => void logout()} className="header-button">
              Disconnect
            </button>
          )}
        </div>
      </header>
      <main id="main">
        {!profile ? (
          <section className="login">
            <p className="eyebrow">FROM OPPORTUNITY TO CONTRIBUTION</p>
            <h1>
              A clear view of
              <br />
              your open-source work.
            </h1>
            <p className="intro">
              Follow verified issues, validation evidence, and review progress from your coding CLI.
            </p>
            <form onSubmit={(e) => void login(e)}>
              <label htmlFor="token">Dashboard access token</label>
              <input
                id="token"
                name="token"
                type="password"
                autoComplete="off"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
                placeholder="mp_…"
              />
              <button disabled={loading || !token}>
                {loading ? 'Connecting…' : 'Connect to your journal'}
              </button>
            </form>
            <details>
              <summary>How to connect</summary>
              <p>Create a scoped dashboard token in the local CLI:</p>
              <code>mergepilot issue-token local read</code>
              <p>Use a dashboard token here. GitHub credentials stay with your coding CLI.</p>
            </details>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
          </section>
        ) : (
          <>
            <div className="page-heading">
              <div>
                <p className="eyebrow">CONTRIBUTION OVERVIEW</p>
                <h1>
                  Small fixes.
                  <br className="mobile-break" /> Meaningful progress.
                </h1>
                <p className="muted">Your evidence, checks, and review outcomes in one journal.</p>
              </div>
              <div className="refresh">
                <button className="quiet" onClick={() => void refresh()} disabled={loading}>
                  {loading ? 'Refreshing…' : 'Refresh journal'}
                </button>
                <small>{updated ? 'Updated ' + date(updated) : 'Loading metadata'}</small>
              </div>
            </div>
            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}
            <ContributionDashboard
              sessions={sessions}
              metrics={metrics}
              onSelect={setSelected}
              selectedId={selected}
            />
            {active && <SessionDetail session={active} onClose={() => setSelected(undefined)} />}
            <section className="panel rejection-panel">
              <div>
                <p className="eyebrow">DISCOVERY QUALITY</p>
                <h2>Why candidates were excluded</h2>
                <p className="muted">
                  Strict filters protect your time and maintainers’ attention.
                </p>
              </div>
              <div>
                {rejections.length ? (
                  <ul className="rejections">
                    {rejections.map(([reason, count]) => (
                      <li key={reason}>
                        <span>{reason}</span>
                        <strong>{count}</strong>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">No candidate rejections recorded.</p>
                )}
              </div>
            </section>
            <p className="footnote">
              {metrics.notice ||
                'Evidence reflects its recorded timestamp. Refresh eligibility before publication.'}
            </p>
          </>
        )}
      </main>
      <footer>
        <span>MergePilot</span>
        <span>Publication and public updates require approval in your local workflow.</span>
      </footer>
    </>
  );
}
