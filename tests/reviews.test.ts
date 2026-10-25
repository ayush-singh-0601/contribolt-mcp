import {it,expect} from 'vitest';
import {codeOwners} from '../src/contribution/reviews.js';
it('applies last-match CODEOWNERS rules to only affected files',()=>{const owners='* @default\n/src/ @org/core\n/src/special.ts @special\n/docs/ @docs';expect(codeOwners(owners,['src/special.ts'])).toEqual(['@special']);expect(codeOwners(owners,['src/other.ts'])).toEqual(['@org/core']);expect(codeOwners(owners,['README.md'])).toEqual(['@default']);});
