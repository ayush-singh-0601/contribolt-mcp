import {it,expect} from 'vitest';
import {conformAdapter} from '../src/languages/extensions.js';
import {genericAdapter} from '../src/languages/generic.js';
it('rejects incomplete extensions and escaping command directories',()=>{expect(()=>conformAdapter({id:'unsafe'})).toThrow('interface');const adapter=conformAdapter({...genericAdapter,id:'custom',commands:()=>[{id:'x',name:'x',kind:'test',executable:'test',args:[],cwd:'/outside',required:true,network:false,timeoutMs:1000,source:'user adapter'}]});expect(()=>adapter.commands({root:process.cwd(),files:[],content:{},scope:''})).toThrow('escapes');});
