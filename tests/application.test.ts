import {it,expect} from 'vitest';
import {Application} from '../src/mcp/application.js';
import {Store} from '../src/state/store.js';
import {fixture} from './helpers.js';
it('starts with three questions and moves to discovery with two answers',async()=>{const f=fixture(),db=new Store(f.root);try{const app=new Application(db);const result=await app.callTool('start_contribution',{}) as {sessionId:string,onboarding:{questions:unknown[]}};expect(result.onboarding.questions).toHaveLength(3);await app.callTool('set_preferences',{sessionId:result.sessionId,preferences:{languages:['Python'],difficulty:'intermediate'}});expect(db.get(result.sessionId).state).toBe('REPOSITORY_DISCOVERY');expect(db.get(result.sessionId).preferences.repositoryPreference).toBe('any');expect(app.profiles.read()).toBeUndefined();}finally{db.close();f.cleanup();}});
