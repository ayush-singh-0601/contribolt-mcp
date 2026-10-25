import {it,expect} from 'vitest';
import {Store} from '../src/state/store.js';
import {PreferencesSchema} from '../src/core/models.js';
import {Publisher,type PublicationBackend} from '../src/contribution/publisher.js';
import {fixture} from './helpers.js';
it('performs no public operation before a complete proposal and approval',async()=>{const f=fixture(),db=new Store(f.root);let writes=0;const backend={fork:async()=>{writes++;throw new Error('unexpected');}} as unknown as PublicationBackend;try{const s=db.create(PreferencesSchema.parse({}),false),p=new Publisher(db,backend,async()=>db.get(s.id));await expect(p.publish(s.id)).rejects.toThrow('proposal');expect(writes).toBe(0);}finally{db.close();f.cleanup();}});
