import {cpp} from './adapters/cpp.js';
import {kotlin} from './adapters/kotlin.js';
import {java} from './adapters/java.js';
import {rust} from './adapters/rust.js';
import {go} from './adapters/go.js';
import {python} from './adapters/python.js';
import {javascript} from './adapters/javascript.js';
import type {LanguageAdapter,RepositoryContext} from './adapter.js';
import {genericAdapter} from './generic.js';
export class AdapterRegistry {
  private adapters:LanguageAdapter[]=[];
  add(adapter:LanguageAdapter):this{if(this.adapters.some(a=>a.id===adapter.id))throw new Error('Duplicate adapter');this.adapters.push(adapter);return this;}
  detect(repo:RepositoryContext):LanguageAdapter[]{const found=this.adapters.filter(a=>a.detect(repo).matched);return found.length?found:[genericAdapter];}
  list():string[]{return this.adapters.map(a=>a.id).concat('generic');}
}
export function builtinRegistry():AdapterRegistry{return new AdapterRegistry().add(javascript).add(python).add(go).add(rust).add(java).add(kotlin).add(cpp);}
