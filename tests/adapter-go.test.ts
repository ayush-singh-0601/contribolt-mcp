import {it,expect} from 'vitest';
import {go as adapter} from '../src/languages/adapters/go.js';
it('selects native Go commands and safe check modes',()=>{
 const content={"go.mod": "module example.invalid/api\ngo 1.24\n"};const repo={root:process.cwd(),scope:'',files:Object.keys(content),content};
 expect(adapter.detect(repo).matched).toBe(true);const checks=adapter.commands(repo);
 expect(checks.find(c=>c.kind==='test')?.args).toEqual(['test','./...']);expect(checks.find(c=>c.kind==='format_check')?.executable).toBe('gofmt');
 expect(adapter.parseResults({exitCode:null,available:false})).toBe('UNAVAILABLE');
 expect(adapter.parseResults({exitCode:1,available:true})).toBe('FAIL');
});
