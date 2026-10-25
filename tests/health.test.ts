import {it,expect} from 'vitest';
import {healthScore} from '../src/discovery/health.js';
it('uses recent maintenance and merged work rather than stars',()=>{const now=Date.now();expect(healthScore(new Date(now-500*86400000).toISOString(),[],now)).toBe(0);expect(healthScore(new Date(now).toISOString(),Array(5).fill({merged_at:new Date(now).toISOString(),updated_at:new Date(now).toISOString()}),now)).toBe(1);});
