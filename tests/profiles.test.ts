import {it,expect} from 'vitest';
import {Store} from '../src/state/store.js';
import {Profiles} from '../src/onboarding/profiles.js';
import {PreferencesSchema} from '../src/core/models.js';
import {fixture} from './helpers.js';
it('does not remember preferences without consent',()=>{const f=fixture(),db=new Store(f.root);try{const p=new Profiles(db),prefs=PreferencesSchema.parse({languages:['Rust']});p.save(prefs,false);expect(p.read()).toBeUndefined();p.save(prefs,true);expect(p.read()?.languages).toEqual(['Rust']);p.forget();expect(p.read()).toBeUndefined();}finally{db.close();f.cleanup();}});
