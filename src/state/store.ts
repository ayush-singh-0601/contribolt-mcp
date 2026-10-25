import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,writeFileSync,renameSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {SessionSchema,type Session,type Preferences} from '../core/models.js';

export class Store {
  readonly db:DatabaseSync;
  constructor(readonly root:string) {
    mkdirSync(root,{recursive:true,mode:0o700});
    this.db=new DatabaseSync(join(root,'state.sqlite'));
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;');
    const version=this.db.prepare('PRAGMA user_version').get() as {user_version:number};
    if(version.user_version>1) throw new Error('State schema is newer than this installation');
    this.db.exec(`CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY, revision INTEGER NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS events(seq INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL, at TEXT NOT NULL, kind TEXT NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS records(namespace TEXT NOT NULL, key TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY(namespace,key)); PRAGMA user_version=1;`);
  }
  create(preferences:Preferences,dryRun=true):Session {
    const now=new Date().toISOString();
    const session=SessionSchema.parse({id:randomUUID(),preferences,state:'ONBOARDING',dryRun,createdAt:now,lastUpdatedAt:now});
    this.db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(session.id,0,JSON.stringify(session));
    this.event(session.id,'created',{dryRun}); return session;
  }
  get(id:string):Session {
    const row=this.db.prepare('SELECT data FROM sessions WHERE id=?').get(id) as {data:string}|undefined;
    if(!row)throw new Error('Session not found');
    return SessionSchema.parse(JSON.parse(row.data));
  }
  list():Session[] { return (this.db.prepare('SELECT data FROM sessions ORDER BY rowid DESC LIMIT 1000').all() as {data:string}[]).map(r=>SessionSchema.parse(JSON.parse(r.data))); }
  mutate(id:string,change:(session:Session)=>void,expectedRevision?:number):Session {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const session=this.get(id), previous=session.state;
      if(expectedRevision!==undefined && session.revision!==expectedRevision)throw new Error('Session changed concurrently; refresh before retry');
      change(session); session.revision++; session.lastUpdatedAt=new Date().toISOString();
      const valid=SessionSchema.parse(session);
      this.db.prepare('UPDATE sessions SET revision=?,data=? WHERE id=?').run(valid.revision,JSON.stringify(valid),id);
      this.event(id,'updated',{from:previous,to:valid.state,revision:valid.revision});
      this.db.exec('COMMIT'); return valid;
    } catch(error) {this.db.exec('ROLLBACK'); throw error;}
  }
  event(id:string,kind:string,data:unknown):void { this.db.prepare('INSERT INTO events(session_id,at,kind,data) VALUES(?,?,?,?)').run(id,new Date().toISOString(),kind,JSON.stringify(data)); }
  events(id:string,after=0):unknown[] { return this.db.prepare('SELECT seq,at,kind,data FROM events WHERE session_id=? AND seq>? ORDER BY seq LIMIT 500').all(id,after); }
  put(namespace:string,key:string,value:unknown):void {this.db.prepare('INSERT INTO records VALUES(?,?,?) ON CONFLICT(namespace,key) DO UPDATE SET data=excluded.data').run(namespace,key,JSON.stringify(value));}
  read<T>(namespace:string,key:string):T|undefined {const row=this.db.prepare('SELECT data FROM records WHERE namespace=? AND key=?').get(namespace,key) as {data:string}|undefined;return row?JSON.parse(row.data) as T:undefined;}
  remove(namespace:string,key:string):void {this.db.prepare('DELETE FROM records WHERE namespace=? AND key=?').run(namespace,key);}
  artifact(id:string,name:string,content:string):string {
    this.get(id);
    if(!/^[a-zA-Z0-9_.-]+$/.test(name)||name==='.'||name==='..')throw new Error('Invalid artifact name');
    const dir=join(this.root,'artifacts',id);mkdirSync(dir,{recursive:true,mode:0o700});
    const file=join(dir,name), temp=file+'.'+randomUUID();writeFileSync(temp,content,{mode:0o600,flag:'wx'});renameSync(temp,file);
    this.mutate(id,s=>{s.artifacts[name]=file;});return file;
  }
  artifactDigest(file:string):string{return createHash('sha256').update(readFileSync(file)).digest('hex');}
  close():void {this.db.close();}
}
