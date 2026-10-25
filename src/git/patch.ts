import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {git} from './workspace.js';
import {within} from '../security/boundaries.js';
export async function patchFingerprint(root:string,base='HEAD'):Promise<string>{
  const hash=createHash('sha256').update(await git(root,['rev-parse',base])).update(await git(root,['diff','--binary',base,'--']));
  const untracked=(await git(root,['ls-files','--others','--exclude-standard','-z'])).split('\0').filter(Boolean).sort();
  for(const file of untracked)hash.update(file+'\0').update(readFileSync(within(root,file)));
  return hash.digest('hex');
}
