import type { Store } from '../state/store.js';
import { defaults, type Session } from '../core/models.js';
import { policyKey } from '../repository/policy-store.js';
import type { PolicyDecision } from '../repository/policies.js';
export function enforceContributionLimits(store: Store, s: Session): void {
  if (!s.repository) throw new Error('Repository required');
  const key = policyKey(s.repository),
    policy = store.read<{ decision: PolicyDecision }>('policies', key),
    interval = Math.max(defaults.cooldownMs, (policy?.decision.cooldownHours ?? 24) * 3600000);
  const last = store.read<{ sessionId: string; at: number }>('publication-cooldowns', key);
  if (last && last.sessionId !== s.id && Date.now() - last.at < interval)
    throw new Error('Repository publication cooldown is active');
  for (const other of store.list()) {
    if (
      other.id === s.id ||
      !other.prUrl ||
      !other.repository ||
      policyKey(other.repository) !== key
    )
      continue;
    const outcome = store.read<{ outcome: string }>('outcomes', other.id);
    if (!outcome || outcome.outcome === 'opened')
      throw new Error(
        'Another contribution to this repository is still open; avoid unsolicited PR floods',
      );
  }
}
