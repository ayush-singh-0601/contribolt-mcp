import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { execFile } from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
export function fixture(files: Record<string, string> = {}) {
  const root = mkdtempSync(join(tmpdir(), 'mergepilot-test-'));
  for (const [name, content] of Object.entries(files)) { const file=join(root,name); mkdirSync(dirname(file),{recursive:true}); writeFileSync(file,content); }
  return { root, cleanup: () => rmSync(root,{recursive:true,force:true}) };
}
export async function gitFixture(files: Record<string,string>={ 'README.md': '# Fixture\n' }) {
  const f=fixture(files);
  const git=async(...args:string[])=>(await exec('git',['-C',f.root,...args],{encoding:'utf8'})).stdout.trim();
  await git('init','-b','main'); await git('config','user.name','Test'); await git('config','user.email','test@example.invalid'); await git('add','.'); await git('commit','-m','baseline');
  return {...f,git};
}
