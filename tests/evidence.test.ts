import {it,expect} from 'vitest';
import {Store} from '../src/state/store.js';
import {PreferencesSchema,CommandSchema} from '../src/core/models.js';
import {executeCheck} from '../src/execution/runner.js';
import {ingestExecutions} from '../src/execution/evidence.js';
import {fixture,gitFixture} from './helpers.js';
import {writeFileSync} from 'node:fs';
it('accepts captured executions and rejects tampered logs and invented execution ids',async()=>{const repo=await gitFixture(),f=fixture(),db=new Store(f.root);try{const s=db.create(PreferencesSchema.parse({}));db.mutate(s.id,x=>{x.workspace=repo.root;x.commands=[CommandSchema.parse({id:'check',name:'git version',kind:'test',executable:'git',args:['--version'],cwd:repo.root,source:'fixture'})];});const run=await executeCheck(db,s.id,'check',{source:'host-approved-execution',network:false});expect((await ingestExecutions(db,s.id,[run.id]))[0]?.status).toBe('PASS');writeFileSync(run.check.outputPath!,'forged pass');await expect(ingestExecutions(db,s.id,[run.id])).rejects.toThrow('modified');await expect(ingestExecutions(db,s.id,['not-an-execution'])).rejects.toThrow('Unknown');}finally{db.close();f.cleanup();repo.cleanup();}});
