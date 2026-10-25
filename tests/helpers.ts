import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
export function fixture(files: Record<string, string> = {}) {
  const root = mkdtempSync(join(tmpdir(), 'mergepilot-test-'));
  for (const [name, content] of Object.entries(files)) { const file=join(root,name); mkdirSync(dirname(file),{recursive:true}); writeFileSync(file,content); }
  return { root, cleanup: () => rmSync(root,{recursive:true,force:true}) };
}
export function gitFixture(files: Record<string,string>={ 'README.md': '# Fixture\n' }) {
  const f=fixture(files);
  const git=(...args:string[])=>execFileSync('git',['-C',f.root,...args],{encoding:'utf8'}).trim();
  git('init','-b','main'); git('config','user.name','Test'); git('config','user.email','test@example.invalid'); git('add','.'); git('commit','-m','baseline');
  return {...f,git};
}
