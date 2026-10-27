import { z } from 'zod';
import { ProposalSchema, type Session, type Proposal } from '../core/models.js';
import type { PatchInspection } from './quality.js';
import { readiness } from './readiness.js';
import type { PolicyDecision } from '../repository/policies.js';
import { safeBranch } from '../security/boundaries.js';
import { redact } from '../core/audit.js';
export const ProposalInput = z
  .object({
    actor: z.string().regex(/^[\w-]+$/),
    authorName: z
      .string()
      .min(1)
      .max(100)
      .refine((s) => !/[\n\r<>]/.test(s)),
    authorEmail: z.email(),
    title: z.string().min(1).max(256),
    body: z.string().max(64000).optional(),
    branch: z.string().optional(),
    draft: z.boolean().default(false),
    templatePath: z.string().optional(),
  })
  .strict();
export function prepareProposal(
  session: Session,
  inspection: PatchInspection,
  input: z.infer<typeof ProposalInput>,
  policy: PolicyDecision,
): Proposal {
  if (
    !session.repository ||
    !session.selectedIssue ||
    !session.repositoryCommitSha ||
    !session.analysis
  )
    throw new Error('Complete analyzed contribution required');
  const verdict = readiness(session, inspection);
  if (verdict.status === 'BLOCKED') throw new Error(verdict.blockers.join('; '));
  if (/[\n\r]|\p{Extended_Pictographic}/u.test(input.title))
    throw new Error('PR title must be plain single-line text');
  if (redact(input.title) !== input.title || (input.body && redact(input.body) !== input.body))
    throw new Error('PR text contains a potential secret');
  const template = input.templatePath
    ? policy.templates.find((t) => t.path === input.templatePath)
    : (policy.templates.find((t) => /bug|fix/i.test(t.path)) ?? policy.templates[0]);
  if (input.templatePath && !template) throw new Error('Unknown project PR template');
  if (template && !input.body)
    throw new Error('Complete the supplied project PR template and pass the filled body');
  const testing = session.validation
    .filter((c) => c.command?.kind !== 'bootstrap')
    .map(
      (c) =>
        `- \`${c.command?.executable ?? c.name} ${c.command?.args.join(' ') ?? ''}\`: ${c.status}${c.explanation ? ' (' + c.explanation + ')' : ''}`,
    )
    .join('\n');
  let body =
    input.body ??
    `## Summary\n${session.analysis.strategy}\n\n## Changes\n${inspection.files.map((f) => '- ' + f).join('\n')}\n\n## Testing\n${testing || '- No automated checks available.'}\n\nRefs #${session.selectedIssue.issueNumber}`;
  if (template) {
    const headings = [...template.text.matchAll(/^#{1,6}\s+(.+)$/gm)].map((m) => m[0]);
    let at = -1;
    for (const heading of headings) {
      const next = body.indexOf(heading, at + 1);
      if (next < 0) throw new Error('PR body must preserve template headings and order');
      at = next;
    }
  }
  if (input.body && testing && !body.includes(testing))
    body += '\n\n### Recorded verification\n' + testing;
  if (/\b(?:TODO|TBD|INSERT HERE)\b|<describe[^>]*>/i.test(body))
    throw new Error('Unfilled PR template placeholders');
  for (const disclosure of policy.disclosures) {
    if (!/AI|artificial intelligence|LLM/i.test(body))
      body += '\n\nAI assistance was used in preparing this contribution. ' + disclosure;
  }
  if (verdict.limitations.length)
    body +=
      '\n\n## Verification limitations\n' + verdict.limitations.map((l) => '- ' + l).join('\n');
  if (
    policy.allowAutoClosingReferences === false &&
    /\b(?:closes|fixes|resolves)\s+#\d+/i.test(body)
  )
    throw new Error('Project policy prohibits automatic issue-closing references');
  if (
    !body.includes('#' + session.selectedIssue.issueNumber) &&
    !body.includes(session.selectedIssue.url)
  )
    throw new Error('PR must reference the selected issue');
  const branch = safeBranch(
    input.branch ??
      `contribolt/issue-${session.selectedIssue.issueNumber}-${session.id.slice(0, 8)}`,
  );
  const commitMessage = `fix: ${input.title}${policy.signoff ? '\n\nSigned-off-by: ' + input.authorName + ' <' + input.authorEmail + '>' : ''}`;
  return ProposalSchema.parse({
    repository: session.repository.fullName,
    issueNumber: session.selectedIssue.issueNumber,
    actor: input.actor,
    authorName: input.authorName,
    authorEmail: input.authorEmail,
    signoff: policy.signoff,
    branch,
    base: session.repository.defaultBranch,
    title: input.title,
    body,
    draft:
      input.draft || policy.requireDraft || verdict.status === 'READY_WITH_DISCLOSED_LIMITATIONS',
    patchHash: inspection.patchHash,
    baseSha: session.repositoryCommitSha,
    commitMessage,
    files: inspection.files,
    disclosures: policy.disclosures,
    readyWithLimitations: verdict.status === 'READY_WITH_DISCLOSED_LIMITATIONS',
  });
}
