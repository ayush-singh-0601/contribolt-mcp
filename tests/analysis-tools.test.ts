import { it, expect } from 'vitest';
import { Application } from '../src/mcp/application.js';
import { registerAnalysis } from '../src/mcp/analysis-tools.js';
import { Store } from '../src/state/store.js';
import { PreferencesSchema } from '../src/core/models.js';
import { fixture } from './helpers.js';
it('does not clone or plan an unverified candidate', async () => {
  const f = fixture(),
    db = new Store(f.root);
  try {
    const s = db.create(PreferencesSchema.parse({})),
      app = new Application(db);
    registerAnalysis(app);
    await expect(app.callTool('analyze_repository', { sessionId: s.id })).rejects.toThrow(
      'verified',
    );
    await expect(app.callTool('plan_fix', { sessionId: s.id })).rejects.toThrow('Record');
  } finally {
    db.close();
    f.cleanup();
  }
});
