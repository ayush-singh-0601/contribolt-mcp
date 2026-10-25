import {it,expect} from 'vitest';
import {ProposalInput} from '../src/contribution/prepare.js';
import {safeBranch} from '../src/security/boundaries.js';
it('rejects forged identities and unsafe publication destinations before preparation',()=>{expect(ProposalInput.safeParse({actor:'actor',authorName:'person\nSigned-off-by: other',authorEmail:'p@example.invalid',title:'Fix behavior'}).success).toBe(false);expect(()=>safeBranch('fix/../main')).toThrow();expect(ProposalInput.safeParse({actor:'actor',authorName:'Person',authorEmail:'person@example.invalid',title:'Fix behavior',approved:true}).success).toBe(false);});
