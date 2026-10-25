import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {Store} from '../src/state/store.js';
import {PreferencesSchema} from '../src/core/models.js';
import {exportMetadata,importMetadata,summaries} from '../src/http/metadata.js';
import {fixture} from './helpers.js';
it('exports selected summaries without local paths or logs and cannot import authorization',()=>{const a=fixture(),b=fixture(),source=new Store(a.root),target=new Store(b.root);try{const s=source.create(PreferencesSchema.parse({}));source.mutate(s.id,x=>{x.workspace='/private/source';x.publishApproved=true;});const payload=exportMetadata(source,randomUUID(),[s.id]);expect(JSON.stringify(payload)).not.toContain('/private/source');expect(JSON.stringify(payload)).not.toContain('publishApproved');expect(importMetadata(target,payload)).toBe(1);expect(summaries(target)[0]?.source).toBe('synced');expect(()=>target.get(s.id)).toThrow('not found');expect(()=>importMetadata(target,{...payload,sessions:[{...payload.sessions[0],workspace:'/leak'}]})).toThrow();}finally{source.close();target.close();a.cleanup();b.cleanup();}});
