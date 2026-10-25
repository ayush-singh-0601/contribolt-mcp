import {cp,rm,mkdir,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const source=join(root,'dashboard','dist'),target=join(root,'dist','dashboard');
await stat(join(source,'index.html'));
await rm(target,{recursive:true,force:true});await mkdir(target,{recursive:true});await cp(source,target,{recursive:true});
console.log('Packaged dashboard assets in dist/dashboard.');
