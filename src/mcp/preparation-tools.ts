import { policyKey } from '../repository/policy-store.js';
import type { Application } from './application.js';
import { sessionInput } from './registry.js';
import { ProposalInput, prepareProposal } from '../contribution/prepare.js';
import { inspectPatch } from '../contribution/quality.js';
import type { PolicyDecision } from '../repository/policies.js';
export function registerPreparation(app: Application) {
  app.register({
    name: 'prepare_pull_request',
    description:
      'Prepare a complete local PR preview using actual checks, the project template and required disclosures.',
    schema: sessionInput.extend({ proposal: ProposalInput }),
    readOnly: false,
    publicWrite: false,
    handler: async (a) => {
      const id = String(a.sessionId),
        s = app.store.get(id);
      const policy = app.store.read<{ decision: PolicyDecision }>(
        'policies',
        s.repository ? policyKey(s.repository) : '',
      );
      if (!policy) throw new Error('Verified policy snapshot required');
      const inspection = await inspectPatch(s),
        proposal = prepareProposal(s, inspection, ProposalInput.parse(a.proposal), policy.decision);
      app.store.mutate(id, (x) => {
        x.proposal = proposal;
        x.publishApproved = false;
        x.state = 'USER_APPROVAL_TO_PUBLISH';
      });
      const artifact = app.store.artifact(
        id,
        'pull_request.md',
        `# ${proposal.title}\n\n${proposal.body}`,
      );
      return {
        proposal,
        artifact,
        diffStat: inspection.stat,
        requirements: { dco: policy.decision.signoff, cla: policy.decision.claUrls },
        nextAction: 'request_approval',
      };
    },
  });
}
