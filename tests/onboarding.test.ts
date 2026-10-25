import { it, expect } from 'vitest';
import { onboardingInteraction } from '../src/onboarding/questions.js';
it('offers identical three questions to text and form clients without URL requirements', () => {
  const plain = onboardingInteraction(false),
    form = onboardingInteraction(true);
  expect(plain.questions).toEqual(form.questions);
  expect(plain.questions).toHaveLength(3);
  expect(plain.text).not.toMatch(/issue URL|repository URL/);
});
