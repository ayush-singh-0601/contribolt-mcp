import {it,expect} from 'vitest';
import {php as adapter} from '../src/languages/adapters/php.js';
it('selects native PHP commands and safe check modes',()=>{
 const content={"composer.json": "{\"require\":{\"php\":\">=8.2\"},\"require-dev\":{\"pestphp/pest\":\"^3\"}}"};const repo={root:process.cwd(),scope:'',files:Object.keys(content),content};
 expect(adapter.detect(repo).matched).toBe(true);const checks=adapter.commands(repo);
 expect(checks[0]?.executable).toBe('php');expect(checks[0]?.args).toEqual(['vendor/bin/pest']);
 expect(adapter.parseResults({exitCode:null,available:false})).toBe('UNAVAILABLE');
 expect(adapter.parseResults({exitCode:1,available:true})).toBe('FAIL');
});
