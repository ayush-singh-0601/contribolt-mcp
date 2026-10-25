import {it,expect} from 'vitest';
import {Store} from '../src/state/store.js';
import {PreferencesSchema} from '../src/core/models.js';
import {Approvals} from '../src/security/approvals.js';
import {SessionControls} from '../src/state/controls.js';
import {fixture} from './helpers.js';
it('rejects unchecked, mismatched, consumed and revoked approvals',async()=>{const f=fixture(),db=new Store(f.root);try{const s=db.create(PreferencesSchema.parse({})),approvals=new Approvals(db),payload={prUrl:'https://github.com/o/r/pull/1',reviewers:['maintainer'],teams:[]};const request=approvals.request(s.id,'review',payload);expect(()=>approvals.authorize(request.id,s.id,'review',payload)).toThrow();await approvals.confirmFromHuman(request.id);expect(()=>approvals.authorize(request.id,s.id,'review',{...payload,reviewers:['other']})).toThrow();approvals.authorize(request.id,s.id,'review',payload);approvals.reserve(request.id,'intent');approvals.consume(request.id,'intent');expect(()=>approvals.authorize(request.id,s.id,'review',payload)).toThrow('used');const next=approvals.request(s.id,'review',payload);new SessionControls(db).stop(s.id);await expect(approvals.confirmFromHuman(next.id)).rejects.toThrow('revoked');}finally{db.close();f.cleanup();}});
