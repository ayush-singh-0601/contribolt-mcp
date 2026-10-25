import {it,expect} from 'vitest';
import {projectScopes,executableAvailable} from '../src/languages/environment.js';
import type {RepositoryIndex} from '../src/repository/indexing.js';
it('selects nearest affected packages in mixed monorepos',()=>{const index={manifests:['package.json','packages/web/package.json','services/api/go.mod']} as RepositoryIndex;expect(projectScopes(index,['packages/web/src/a.ts','services/api/main.go'])).toEqual(['packages/web','services/api']);expect(executableAvailable('mergepilot-tool-that-does-not-exist','/tmp')).toBe(false);});
