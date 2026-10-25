import {it,expect} from 'vitest';
import {referencesIssue} from '../src/discovery/competing.js';
it('does not confuse issue numbers or ignore canonical closing URLs',()=>{expect(referencesIssue('Closes #12','o/r',12)).toBe(true);expect(referencesIssue('Closes #123','o/r',12)).toBe(false);expect(referencesIssue('https://github.com/o/r/issues/12','o/r',12)).toBe(true);});
