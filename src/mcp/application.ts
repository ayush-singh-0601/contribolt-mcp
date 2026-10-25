import { z } from 'zod';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ToolRegistry, sessionInput } from './registry.js';
import { Store } from '../state/store.js';
import { SessionControls } from '../state/controls.js';
import { Profiles } from '../onboarding/profiles.js';
import { normalizePreferences } from '../onboarding/preferences.js';
import { onboardingInteraction } from '../onboarding/questions.js';
import { PreferencesSchema, AnalysisSchema } from '../core/models.js';
import { nextAction } from '../core/workflow.js';
import { within } from '../security/boundaries.js';
import { redact } from '../core/audit.js';
export class Application extends ToolRegistry {
  readonly controls: SessionControls;
  readonly profiles: Profiles;
  constructor(readonly store: Store) {
    super();
    this.controls = new SessionControls(store);
    this.profiles = new Profiles(store);
    const add = (
      name: string,
      description: string,
      schema: z.ZodType,
      readOnly: boolean,
      handler: (a: Record<string, unknown>) => Promise<unknown>,
    ) => this.register({ name, description, schema, readOnly, publicWrite: false, handler });
    add(
      'start_contribution',
      'Start autonomous contribution discovery; no repository or issue URL required.',
      z
        .object({
          preferences: PreferencesSchema.optional(),
          dryRun: z.boolean().default(true),
          formSupported: z.boolean().default(false),
        })
        .strict(),
      false,
      async (a) => {
        const saved = this.profiles.read(),
          supplied = a.preferences ?? saved;
        let s = store.create(
          normalizePreferences((supplied ?? {}) as Record<string, unknown>),
          Boolean(a.dryRun),
        );
        if (supplied)
          s = store.mutate(s.id, (x) => {
            x.state = 'REPOSITORY_DISCOVERY';
          });
        return {
          sessionId: s.id,
          state: s.state,
          preferences: s.preferences,
          onboarding: supplied ? undefined : onboardingInteraction(Boolean(a.formSupported)),
          nextAction: nextAction(s),
        };
      },
    );
    add(
      'set_preferences',
      'Set preferences; save across sessions only when remember=true.',
      sessionInput.extend({
        preferences: PreferencesSchema.partial(),
        remember: z.boolean().default(false),
      }),
      false,
      async (a) => {
        const p = normalizePreferences(a.preferences as Record<string, unknown>);
        this.profiles.save(p, Boolean(a.remember));
        const s = store.mutate(String(a.sessionId), (x) => {
          if (x.prUrl) throw new Error('Start a new session to change a published contribution');
          if (x.state !== 'ONBOARDING' && x.state !== 'REPOSITORY_DISCOVERY')
            throw new Error('Use change_preferences to reset the active candidate first');
          x.preferences = p;
          x.state = 'REPOSITORY_DISCOVERY';
        });
        return { session: s, nextAction: nextAction(s) };
      },
    );
    add(
      'get_status',
      'Read session evidence and the next safe action.',
      sessionInput,
      true,
      async (a) => this.controls.status(String(a.sessionId)),
    );
    add(
      'resume_session',
      'Resume interrupted work; approval is never restored implicitly.',
      sessionInput,
      false,
      async (a) => {
        const s = this.controls.resume(String(a.sessionId));
        return { session: s, nextAction: nextAction(s) };
      },
    );
    add(
      'control_session',
      'Stop, skip, find another issue, change preferences, or forget saved preferences.',
      sessionInput.extend({
        action: z.enum([
          'stop',
          'skip',
          'find_another',
          'change_preferences',
          'forget_preferences',
        ]),
      }),
      false,
      async (a) => {
        const id = String(a.sessionId);
        if (a.action === 'stop') return this.controls.stop(id);
        if (a.action === 'forget_preferences') {
          this.profiles.forget();
          return { forgotten: true };
        }
        const s = this.controls.skip(id);
        if (a.action === 'change_preferences')
          return store.mutate(id, (x) => {
            x.state = 'ONBOARDING';
          });
        return s;
      },
    );
    add(
      'record_analysis',
      'Record host investigation with source references; this is not permission to publish.',
      sessionInput.extend({ analysis: AnalysisSchema }),
      false,
      async (a) =>
        store.mutate(String(a.sessionId), (s) => {
          if (!s.selectedIssue || !s.workspace)
            throw new Error('Select and analyze an isolated repository first');
          s.analysis = AnalysisSchema.parse(a.analysis);
          s.publishApproved = false;
          s.validation = [];
          s.proposal = undefined;
        }),
    );
    add(
      'get_execution_plan',
      'Read the approved command plan; execution belongs to the host environment.',
      sessionInput,
      true,
      async (a) => {
        const s = store.get(String(a.sessionId));
        return {
          commands: s.commands,
          workspace: s.workspace,
          notice:
            'Commands require host execution approval. The wrapper does not provide sandboxing.',
        };
      },
    );
  }
  resources() {
    return this.store.list().map((s) => ({
      uri: `mergepilot://session/${s.id}`,
      name: s.id,
      mimeType: 'application/json',
    }));
  }
  async readResource(uri: string) {
    const url = new URL(uri);
    if (url.protocol !== 'mergepilot:' || url.hostname !== 'session')
      throw new Error('Unknown resource');
    const parts = url.pathname.split('/').filter(Boolean),
      id = z.uuid().parse(parts[0]);
    const session = this.store.get(id);
    if (parts.length === 1)
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(redact(this.controls.status(id))),
          },
        ],
      };
    if (parts.length !== 2) throw new Error('Invalid artifact resource');
    const name = parts[1]!;
    const file = session.artifacts[name];
    if (!file) throw new Error('Unknown artifact');
    const safe = within(join(this.store.root, 'artifacts', id), file);
    return {
      contents: [
        {
          uri,
          mimeType: 'text/plain',
          text: String(redact(readFileSync(safe, 'utf8').slice(0, 64000))),
        },
      ],
    };
  }
}
