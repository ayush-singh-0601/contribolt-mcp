import {it,expect} from 'vitest';
import {Store} from '../src/state/store.js';
import {SessionControls} from '../src/state/controls.js';
import {PreferencesSchema} from '../src/core/models.js';
import {fixture} from './helpers.js';
it('cancels work and never carries approval through resume',()=>{const f=fixture(),db=new Store(f.root);try{const s=db.create(PreferencesSchema.parse({})),c=new SessionControls(db),signal=c.signal(s.id);c.stop(s.id);expect(signal.aborted).toBe(true);expect(c.resume(s.id).publishApproved).toBe(false);expect(c.signal(s.id).aborted).toBe(false);expect(()=>c.assertWritable(s.id)).toThrow('Dry run');}finally{db.close();f.cleanup();}});
