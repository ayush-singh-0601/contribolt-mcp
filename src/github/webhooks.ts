import { createHmac, timingSafeEqual, createHash } from 'node:crypto';
import { z } from 'zod';
import type { Store } from '../state/store.js';
import { policyKey } from '../repository/policy-store.js';
export function verifyWebhook(raw: Buffer, signature: string, secret: string): void {
  if (secret.length < 32 || !/^sha256=[a-f0-9]{64}$/.test(signature))
    throw new Error('Invalid webhook signature');
  const expected = createHmac('sha256', secret).update(raw).digest(),
    received = Buffer.from(signature.slice(7), 'hex');
  if (!timingSafeEqual(expected, received)) throw new Error('Invalid webhook signature');
}
const Payload = z
  .object({
    action: z.string().optional(),
    installation: z.object({
      id: z.number().int().positive(),
      account: z.object({ login: z.string() }).optional(),
    }),
    repository: z
      .object({
        id: z.number().int().positive(),
        full_name: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
        private: z.boolean(),
      })
      .optional(),
  })
  .passthrough();
const events = new Set([
  'issues',
  'issue_comment',
  'pull_request',
  'pull_request_review',
  'pull_request_review_comment',
  'check_run',
  'check_suite',
  'status',
  'push',
  'installation',
  'installation_repositories',
]);
export class WebhookReceiver {
  constructor(
    private store: Store,
    private secret: string,
    private installationId: number,
  ) {}
  receive(
    raw: Buffer,
    event: string,
    signature: string,
    delivery: string,
  ): { duplicate: boolean; affected: number; ignored: boolean } {
    if (raw.length > 1048576) throw new Error('Webhook payload exceeds size limit');
    verifyWebhook(raw, signature, this.secret);
    z.uuid().parse(delivery);
    const payload = Payload.parse(JSON.parse(raw.toString('utf8')));
    if (payload.installation.id !== this.installationId)
      throw new Error('Webhook installation is not configured');
    const payloadHash = createHash('sha256').update(event).update(raw).digest('hex'),
      previous = this.store.read<{ state?: string; payloadHash?: string }>(
        'webhook-deliveries',
        delivery,
      );
    if (previous?.payloadHash && previous.payloadHash !== payloadHash)
      throw new Error('Webhook delivery identity changed');
    if (previous && previous.state !== 'pending')
      return { duplicate: true, affected: 0, ignored: false };
    const record = {
      event,
      payloadHash,
      installationId: this.installationId,
      at: new Date().toISOString(),
    };
    this.store.put('webhook-deliveries', delivery, { ...record, state: 'pending' });
    const complete = (affected: number, ignored: boolean) => {
      this.store.put('webhook-deliveries', delivery, { ...record, state: 'applied' });
      return { duplicate: false, affected, ignored };
    };
    if (!events.has(event)) return complete(0, true);
    if (event === 'installation')
      this.store.put('app-status', String(this.installationId), {
        active: payload.action !== 'deleted' && payload.action !== 'suspend',
        account: payload.installation.account?.login,
        checkedAt: new Date().toISOString(),
      });
    if (!payload.repository || payload.repository.private) return complete(0, true);
    let affected = 0;
    for (const s of this.store.list()) {
      if (
        s.repository?.forge !== 'github' ||
        s.repository.fullName !== payload.repository.full_name ||
        s.repository.id !== String(payload.repository.id)
      )
        continue;
      this.store.put('external-events', s.id, {
        delivery,
        event,
        action: payload.action,
        at: new Date().toISOString(),
        needsRecheck: true,
      });
      this.store.put('approval-revocations', s.id, Date.now());
      this.store.remove('monitor', s.id);
      if (event === 'push') this.store.remove('policies', policyKey(s.repository));
      this.store.mutate(s.id, (x) => {
        x.publishApproved = false;
      });
      this.store.event(s.id, 'verified-webhook', {
        delivery,
        event,
        action: payload.action,
        installationId: this.installationId,
      });
      affected++;
    }
    return complete(affected, false);
  }
}
