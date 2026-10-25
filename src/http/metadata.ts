import { z } from 'zod';
import type { Store } from '../state/store.js';
import type { Session } from '../core/models.js';
import { StateSchema, PolicySchema } from '../core/models.js';
import type { MonitorSnapshot } from '../contribution/monitor.js';
import { redact } from '../core/audit.js';
const https = z.url().refine((value) => new URL(value).protocol === 'https:', 'Expected HTTPS URL');
export const SummarySchema = z
  .object({
    id: z.uuid(),
    state: StateSchema,
    source: z.enum(['local', 'synced']).default('synced'),
    updatedAt: z.iso.datetime(),
    repository: z
      .object({
        name: z.string().max(200),
        url: https,
        forge: z.enum(['github', 'gitlab', 'forgejo']),
      })
      .strict()
      .optional(),
    issue: z
      .object({
        number: z.number().int().positive(),
        title: z.string().max(1000),
        url: https,
        eligibility: z.enum(['ELIGIBLE', 'INELIGIBLE', 'UNKNOWN']),
        confidence: z.enum(['high', 'medium', 'low']),
        checkedAt: z.iso.datetime(),
        score: z.number().min(0).max(100).optional(),
        discussionComments: z.number().int().nonnegative().optional(),
        assignees: z.array(z.string()).optional(),
        author: z.string().optional(),
        provenance: z.enum(['ELIGIBLE', 'INELIGIBLE', 'UNKNOWN']).optional(),
        linkedPRs: z.array(https).optional(),
      })
      .strict()
      .optional(),
    policy: PolicySchema,
    checks: z
      .array(
        z
          .object({
            name: z.string().max(200),
            status: z.enum(['PASS', 'FAIL', 'SKIPPED', 'UNAVAILABLE']),
            verified: z.boolean(),
          })
          .strict(),
      )
      .max(100),
    blockers: z.array(z.string().max(2000)).max(100),
    prUrl: https.optional(),
    outcome: z.enum(['opened', 'merged', 'closed_without_merge']).optional(),
    milestones: z.record(z.string(), z.boolean()),
    rejectionCounts: z.record(z.string(), z.number().int().nonnegative()).default({}),
    negativeMetrics: z.record(z.string().max(100), z.number().int().nonnegative()).default({}),
    relaxations: z.array(z.string().max(100)).max(4).default([]),
    evidence: z
      .array(
        z
          .object({
            url: https,
            checkedAt: z.iso.datetime(),
            observation: z.string().max(2000),
            complete: z.boolean(),
          })
          .strict(),
      )
      .max(100)
      .default([]),
    candidates: z
      .array(
        z
          .object({
            title: z.string().max(1000),
            url: https,
            eligibility: z.enum(['ELIGIBLE', 'INELIGIBLE', 'UNKNOWN']),
            score: z.number().optional(),
            reasons: z.array(z.string().max(2000)).max(100),
          })
          .strict(),
      )
      .max(100)
      .default([]),
  })
  .strict();
export type SessionSummary = z.infer<typeof SummarySchema>;
export const SyncSchema = z
  .object({
    schemaVersion: z.literal(1),
    deviceId: z.uuid(),
    sessions: z.array(SummarySchema).max(100),
  })
  .strict();
export type SyncPayload = z.infer<typeof SyncSchema>;
export function summarize(store: Store, s: Session): SessionSummary {
  const monitor = store.read<MonitorSnapshot>('monitor', s.id),
    outcome = store.read<{ outcome: 'opened' | 'merged' | 'closed_without_merge' }>(
      'outcomes',
      s.id,
    ),
    counts: Record<string, number> = {};
  for (const candidate of s.candidates)
    for (const reason of candidate.rejectReasons) counts[reason] = (counts[reason] ?? 0) + 1;
  return SummarySchema.parse(
    redact({
      id: s.id,
      state: s.state,
      source: 'local',
      updatedAt: s.lastUpdatedAt,
      repository: s.repository
        ? { name: s.repository.fullName, url: s.repository.url, forge: s.repository.forge }
        : undefined,
      issue: s.selectedIssue
        ? {
            number: s.selectedIssue.issueNumber,
            title: s.selectedIssue.title,
            url: s.selectedIssue.url,
            eligibility: s.selectedIssue.eligibility,
            confidence: s.selectedIssue.confidence,
            checkedAt: s.selectedIssue.checkedAt,
            score: s.selectedIssue.score,
            discussionComments: s.selectedIssue.discussionComments,
            assignees: s.selectedIssue.assignees,
            author: s.selectedIssue.authorLogin,
            provenance: s.selectedIssue.officialProvenance,
            linkedPRs: [...s.selectedIssue.knownLinkedPRs, ...s.selectedIssue.competingPRs],
          }
        : undefined,
      policy: s.policyDecision,
      checks: s.validation.map((c) => ({ name: c.name, status: c.status, verified: c.verified })),
      blockers: s.blockers,
      prUrl: s.prUrl,
      outcome: outcome?.outcome,
      milestones: {
        onboarded: s.state !== 'ONBOARDING' && s.state !== 'IDLE',
        repositories_discovered: s.repositories.length > 0,
        verified:
          s.candidates.some((c) => c.eligibility === 'ELIGIBLE') ||
          s.selectedIssue?.eligibility === 'ELIGIBLE',
        reproduced: s.analysis?.reproduced ?? false,
        implemented: !!s.proposal || !!s.prUrl,
        tested: s.validation.some(
          (c) => c.verified && c.status === 'PASS' && c.command?.kind === 'test',
        ),
        pr_prepared: !!s.proposal || !!s.prUrl,
        pr_opened: !!s.prUrl,
        ci_passing:
          !!monitor?.complete &&
          !!monitor.ci.length &&
          monitor.ci.every((c) => ['success', 'passed'].includes(c.status)),
        reviews_observed: monitor?.feedback.some((f) => f.kind === 'review' && !f.bot) ?? false,
        merged: outcome?.outcome === 'merged',
      },
      rejectionCounts: counts,
      negativeMetrics: store.read<Record<string, number>>('negative-metrics', s.id) ?? {},
      relaxations: store.read<string[]>('relaxations', s.id) ?? [],
      evidence: (s.selectedIssue?.evidence ?? s.policySources)
        .filter((e) => {
          try {
            return new URL(e.source).protocol === 'https:';
          } catch {
            return false;
          }
        })
        .slice(0, 100)
        .map((e) => ({
          url: e.source,
          checkedAt: e.checkedAt,
          observation: e.observation.slice(0, 2000),
          complete: e.complete,
        })),
      candidates: s.candidates.slice(0, 100).map((c) => ({
        title: c.title,
        url: c.url,
        eligibility: c.eligibility,
        score: c.score,
        reasons: c.rejectReasons,
      })),
    }),
  );
}
export function summaries(store: Store): SessionSummary[] {
  const imported = (
    store.db
      .prepare("SELECT data FROM records WHERE namespace='synced-sessions' ORDER BY key LIMIT 1000")
      .all() as { data: string }[]
  ).map((r) => SummarySchema.parse(JSON.parse(r.data)));
  const merged = new Map(imported.map((s) => [s.id, s]));
  for (const s of store.list()) merged.set(s.id, summarize(store, s));
  return [...merged.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export function importMetadata(store: Store, input: unknown): number {
  const payload = SyncSchema.parse(input);
  for (const session of payload.sessions) {
    const value = SummarySchema.parse(redact({ ...session, source: 'synced' }));
    store.put('synced-sessions', payload.deviceId + ':' + session.id, value);
  }
  return payload.sessions.length;
}
export function exportMetadata(store: Store, deviceId: string, ids: string[]): SyncPayload {
  if (!ids.length) throw new Error('Select sessions explicitly before exporting metadata');
  return SyncSchema.parse({
    schemaVersion: 1,
    deviceId,
    sessions: ids.map((id) => summarize(store, store.get(id))),
  });
}
export function aggregateMetadata(items: SessionSummary[]) {
  const funnel: Record<string, number> = {},
    rejections: Record<string, number> = {},
    negativeMetrics: Record<string, number> = {};
  for (const s of items) {
    for (const [stage, reached] of Object.entries(s.milestones))
      if (reached) funnel[stage] = (funnel[stage] ?? 0) + 1;
    for (const [reason, count] of Object.entries(s.rejectionCounts))
      rejections[reason] = (rejections[reason] ?? 0) + count;
    for (const [kind, count] of Object.entries(s.negativeMetrics))
      negativeMetrics[kind] = (negativeMetrics[kind] ?? 0) + count;
  }
  return {
    sessions: items.length,
    local: items.filter((s) => s.source === 'local').length,
    synced: items.filter((s) => s.source === 'synced').length,
    funnel,
    rejections,
    negativeMetrics,
    notice:
      'Synced metadata is reported by its source device and is never execution evidence or publication authorization. Historical outcomes do not guarantee a merge.',
  };
}
