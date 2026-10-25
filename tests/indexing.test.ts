import {it,expect} from 'vitest';
import {gitFixture} from './helpers.js';
import {indexRepository} from '../src/repository/indexing.js';
it('scopes a mixed monorepo without losing its native manifests',async()=>{const f=await gitFixture({'web/package.json':'{}','api/go.mod':'module example.invalid/api','web/src/a.ts':"import {x} from './b.js'"});try{const index=await indexRepository(f.root,[],'web');expect(index.manifests).toEqual(['web/package.json']);expect(index.files).not.toContain('api/go.mod');expect(index.imports['web/src/a.ts']).toEqual(['web/src/b.js']);}finally{f.cleanup();}});
