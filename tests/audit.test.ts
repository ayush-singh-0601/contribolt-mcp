import {expect,it} from 'vitest';
import {redact} from '../src/core/audit.js';
it('redacts nested credentials and embedded tokens without hiding check results',()=>{expect(redact({authorization:'abc',nested:['Bearer abc', 'ghp_'+'a'.repeat(36)],exitCode:1})).toEqual({authorization:'[REDACTED]',nested:['[REDACTED]','[REDACTED]'],exitCode:1});});
