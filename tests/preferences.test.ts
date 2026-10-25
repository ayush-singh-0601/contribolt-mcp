import {it,expect} from 'vitest';
import {normalizePreferences,searchLanguages} from '../src/onboarding/preferences.js';
it('normalizes two answers and preserves the displayed third default',()=>{const p=normalizePreferences({languages:'ts, Python, ts',difficulty:'Intermediate'});expect(p.languages).toEqual(['TypeScript','Python']);expect(p.repositoryPreference).toBe('any');expect(searchLanguages(normalizePreferences({languages:'React, ts'}))).toEqual(['TypeScript']);});
