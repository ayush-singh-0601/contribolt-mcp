import { defineConfig } from 'vitest/config';
export default defineConfig({ esbuild:{jsx:'automatic'}, test: { include: ['tests/**/*.test.ts'], passWithNoTests: true, maxWorkers: 2, testTimeout: 15000 } });
