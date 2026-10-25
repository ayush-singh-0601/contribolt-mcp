import type { Store } from '../state/store.js';
import { PreferencesSchema, type Preferences } from '../core/models.js';
export class Profiles {
  constructor(private store: Store) {}
  read(): Preferences | undefined {
    const value = this.store.read<unknown>('profiles', 'default');
    return value ? PreferencesSchema.parse(value) : undefined;
  }
  save(preferences: Preferences, remember: boolean): void {
    if (remember) this.store.put('profiles', 'default', PreferencesSchema.parse(preferences));
  }
  forget(): void {
    this.store.remove('profiles', 'default');
  }
}
